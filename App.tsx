import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay } from '@/utils/decoder';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'live'>('home');
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis'>('link');
  const [hardwareMode, setHardwareMode] = useState<'pcan' | 'esp32-serial' | 'esp32-bt'>('pcan');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [pcanAddress, setPcanAddress] = useState('192.168.1.100:8080');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });

  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const isPausedRef = useRef(isPaused);
  const currentFramesRef = useRef<CANFrame[]>([]);
  
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { currentFramesRef.current = frames; }, [frames]);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const generateTraceFile = useCallback((framesToSave: CANFrame[], isAuto: boolean = false) => {
    if (!framesToSave || framesToSave.length === 0) {
      addDebugLog("SAVE_ERROR: Buffer is empty.");
      return;
    }
    
    setIsSaving(true);
    addDebugLog(`SYSTEM: Exporting ${framesToSave.length} packets...`);
    
    const startTime = new Date().toISOString();
    const fileName = `OSM_Trace_${isAuto ? 'Auto' : 'Manual'}_${Date.now()}.trc`;
    
    const lines: string[] = [];
    lines.push(`$VERSION=1.1`);
    lines.push(`$STARTTIME=${startTime}`);
    lines.push(`; Log Type: ${isAuto ? 'AUTO_ROLLOVER' : 'MANUAL_EXPORT'}`);
    lines.push(`; Frames: ${framesToSave.length}`);
    lines.push(`;`);
    lines.push(`;   Message   Time      Type ID              Rx/Tx`);
    lines.push(`;   Number    Offset    |    [hex]           |  Data Length`);
    lines.push(`;   |         [ms]      |    |               |  |  Data [hex] ...`);
    lines.push(`;---+--  ---+----  ---+--  ---------+--  -+- +- +- -- -- -- -- -- -- -- --`);

    for (let i = 0; i < framesToSave.length; i++) {
      const f = framesToSave[i];
      const msgNum = (i + 1).toString().padStart(7, ' ');
      const timeStr = (f.timestamp / 1000).toFixed(6).padStart(12, ' ');
      const id = f.id.replace('0x', '').toUpperCase().padStart(12, ' ');
      const dlc = f.dlc.toString().padStart(2, ' ');
      const dataStr = f.data.join(' ');
      lines.push(` ${msgNum}  ${timeStr}  DT  ${id}  Rx ${dlc} ${dataStr}`);
    }

    const content = lines.join('\n');

    // MOBILE BRIDGE EXECUTION
    const nativeInterface = (window as any).AndroidInterface;
    if (nativeInterface && nativeInterface.saveFile) {
        try {
            nativeInterface.saveFile(content, fileName);
            addDebugLog("SYSTEM: Sent to Mobile Native IO.");
            setIsSaving(false);
            return;
        } catch (e) {
            addDebugLog(`NATIVE_BRIDGE_ERROR: ${e}`);
        }
    }

    // WEB FALLBACK
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      addDebugLog("SYSTEM: Web Browser download triggered.");
      
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsSaving(false);
      }, 2000);
    } catch (err) {
      addDebugLog(`EXPORT_ERROR: ${err}`);
      setIsSaving(false);
    }
  }, [addDebugLog]);

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[]) => {
    if (isPausedRef.current) return;
    const normId = normalizeId(id, true);
    if (!normId) return;
    const displayId = `0x${formatIdForDisplay(normId)}`;
    const prev = frameMapRef.current.get(normId);
    
    const newFrame: CANFrame = {
      id: displayId, dlc,
      data: data.map(d => d.toUpperCase().trim()), 
      timestamp: performance.now(),
      absoluteTimestamp: Date.now(),
      direction: 'Rx',
      count: (prev?.count || 0) + 1,
      periodMs: prev ? Math.round(performance.now() - prev.timestamp) : 0
    };
    frameMapRef.current.set(normId, newFrame);
    pendingFramesRef.current.push(newFrame);
  }, []);

  useEffect(() => {
    (window as any).onNativeBleData = (line: string) => {
      const parts = line.split('#');
      if (parts.length >= 3) {
        handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
      }
    };
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(msg);
    (window as any).onNativeBleStatus = (status: string) => {
      if (status === 'connected') setBridgeStatus('connected');
      else if (status === 'disconnected') setBridgeStatus('disconnected');
    };
  }, [handleNewFrame, addDebugLog]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        
        setFrames(prev => {
          const totalCount = prev.length + batch.length;
          if (totalCount >= MAX_FRAME_LIMIT) {
            addDebugLog(`SYSTEM: Rollover Save Active (${MAX_FRAME_LIMIT} pkts).`);
            const framesToSave = [...prev, ...batch];
            setTimeout(() => generateTraceFile(framesToSave, true), 0);
            frameMapRef.current.clear();
            return [];
          }
          return [...prev, ...batch];
        });

        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => { 
          const cleanId = normalizeId(f.id.replace('0x',''), true);
          latest[cleanId] = f; 
        });
        setLatestFrames(prev => ({ ...prev, ...latest }));
        setHwStatus('active');
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [addDebugLog, generateTraceFile]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
      addDebugLog("ERROR: Web Serial unavailable.");
      return;
    }
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      addDebugLog(`SERIAL: Port Active @ ${baudRate}`);

      keepReadingRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";

      while (port.readable && keepReadingRef.current) {
        serialReaderRef.current = port.readable.getReader();
        try {
          while (true) {
            const { value, done } = await serialReaderRef.current.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine) continue;
              const parts = cleanLine.split('#');
              if (parts.length >= 3) {
                handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
              }
            }
          }
        } finally {
          serialReaderRef.current.releaseLock();
        }
      }
    } catch (err) {
      addDebugLog(`SERIAL_FAIL: ${err}`);
      setBridgeStatus('disconnected');
    }
  };

  const disconnectHardware = useCallback(() => {
    keepReadingRef.current = false;
    if (serialPortRef.current) {
      serialPortRef.current.close();
      serialPortRef.current = null;
    }
    if ((window as any).NativeBleBridge) (window as any).NativeBleBridge.disconnectBle();
    setBridgeStatus('disconnected');
    setHwStatus('offline');
  }, []);

  const onManualSave = () => {
    generateTraceFile(currentFramesRef.current, false);
  };

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6">
        <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
        <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
        <button onClick={() => setView('live')} className="w-full max-w-xs py-6 mt-12 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl">Launch Mobile HUD</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 safe-pt">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('home')} className="p-2"><ArrowLeft size={20} /></button>
          <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
        </div>
        <div className={`w-3 h-3 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      </header>

      <main className="flex-1 overflow-hidden relative">
        {dashboardTab === 'link' ? (
          <ConnectionPanel 
            status={bridgeStatus} 
            hwStatus={hwStatus} 
            hardwareMode={hardwareMode}
            pcanAddress={pcanAddress}
            setPcanAddress={setPcanAddress}
            onSetHardwareMode={setHardwareMode} 
            baudRate={baudRate} 
            setBaudRate={setBaudRate}
            onConnect={() => hardwareMode === 'esp32-serial' ? connectSerial() : (window as any).NativeBleBridge?.startBleLink()} 
            onDisconnect={disconnectHardware} 
            debugLog={debugLog}
          />
        ) : dashboardTab === 'analysis' ? (
          <TraceAnalysisDashboard frames={frames} library={library} />
        ) : dashboardTab === 'trace' ? (
          <CANMonitor 
            frames={frames} 
            isPaused={isPaused} 
            library={library} 
            onSaveTrace={onManualSave}
            isSaving={isSaving}
          />
        ) : (
          <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
        )}
      </main>

      <nav className="h-20 bg-white border-t flex items-center justify-around px-4 pb-2 shrink-0 safe-pb">
        {[
            { id: 'link', icon: Bluetooth, label: 'LINK' },
            { id: 'trace', icon: Activity, label: 'HUD' },
            { id: 'library', icon: Database, label: 'DATA' },
            { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
        ].map(tab => (
            <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                <tab.icon size={20} /><span className="text-[8px] font-orbitron font-black uppercase">{tab.label}</span>
            </button>
        ))}
      </nav>
    </div>
  );
};

export default App;