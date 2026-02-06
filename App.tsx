
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw, Cpu, ArrowLeft, Download, FileUp, Loader2, Database, Activity, Zap, BarChart3, Settings2, ShieldAlert, Cable, AlertTriangle, Power, Save, Bluetooth } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay } from '@/utils/decoder';

type AppView = 'home' | 'live';
type DashboardTab = 'link' | 'trace' | 'library' | 'analysis';
type HardwareMode = 'pcan' | 'esp32-serial' | 'esp32-bt';

const MAX_FRAME_LIMIT = 10000;
const BATCH_UPDATE_INTERVAL = 40; 

// Nordic UART Service UUIDs
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('link');
  const [hardwareMode, setHardwareMode] = useState<HardwareMode>('esp32-serial');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [rxByteCount, setRxByteCount] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });
  
  const isPausedRef = useRef(false);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const sessionStartTimeRef = useRef<number>(performance.now());
  const socketRef = useRef<WebSocket | null>(null);
  const serialPortRef = useRef<any | null>(null);
  const serialReaderRef = useRef<any | null>(null);
  const btDeviceRef = useRef<any | null>(null);
  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const autoSaveCountRef = useRef<number>(0);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const handleSaveTrace = useCallback(async (framesToSave: CANFrame[]) => {
    if (framesToSave.length === 0) return;
    setIsSaving(true);
    addDebugLog(`SYSTEM: AUTO-SAVING TRACE (${framesToSave.length.toLocaleString()} FRAMES)...`);
    
    try {
      const header = "; PCAN Trace File\n; Created by OSM Tactical HUD (Auto-Save)\n;-------------------------------------------------------------------------------\n";
      const rows: string[] = [header];
      
      for (let i = 0; i < framesToSave.length; i++) {
        const f = framesToSave[i];
        const msgNum = (i + 1).toString().padStart(7, ' ');
        const timeStr = (f.timestamp / 1000).toFixed(6).padStart(12, ' ');
        const hexId = f.id.replace('0x', '').toUpperCase().padStart(12, ' ');
        const hexData = f.data.map(d => d.padStart(2, '0')).join(' ');
        rows.push(`${msgNum}  ${timeStr}  DT  ${hexId}  Rx ${f.dlc}  ${hexData}\n`);
      }

      const blob = new Blob(rows, { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      autoSaveCountRef.current++;
      link.download = `OSM_AutoTrace_Part${autoSaveCountRef.current}_${Date.now()}.trc`;
      link.click();
      URL.revokeObjectURL(url);
      addDebugLog(`SYSTEM: AUTO-SAVE PART ${autoSaveCountRef.current} COMPLETE`);
    } catch (err: any) {
      addDebugLog(`SYSTEM_ERROR: AUTO-SAVE FAILED - ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [addDebugLog]);

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[]) => {
    if (isPausedRef.current) return;
    const normId = normalizeId(id, true);
    if (!normId) return;
    const displayId = `0x${formatIdForDisplay(normId)}`;
    const perfNow = performance.now();
    const prev = frameMapRef.current.get(normId);
    
    const newFrame: CANFrame = {
      id: displayId, dlc,
      data: data.map(d => d.toUpperCase().trim()).filter(d => d.length > 0), 
      timestamp: perfNow - sessionStartTimeRef.current,
      absoluteTimestamp: Date.now(),
      direction: 'Rx',
      count: (prev?.count || 0) + 1,
      periodMs: prev ? Math.round(perfNow - (prev.timestamp + sessionStartTimeRef.current)) : 0
    };
    frameMapRef.current.set(normId, newFrame);
    pendingFramesRef.current.push(newFrame);
  }, []);

  const parseESP32Line = useCallback((line: string) => {
    const cleanLine = line.replace(/[\r\n]/g, '').trim();
    if (!cleanLine) return;

    if (!cleanLine.includes('#')) {
      addDebugLog(`HW_INFO: ${cleanLine}`);
      return;
    }

    const parts = cleanLine.split('#');
    if (parts.length >= 3) {
      const id = parts[0].trim();
      const dlc = parseInt(parts[1].trim());
      const rawData = parts[2].trim();
      const data = rawData.split(/[, ]+/).filter(x => x.length > 0);
      
      if (id && !isNaN(dlc) && data.length > 0) {
        handleNewFrame(id, dlc, data);
      }
    }
  }, [addDebugLog, handleNewFrame]);

  useEffect(() => {
    let animationFrame: number;
    const processBatch = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current >= BATCH_UPDATE_INTERVAL && pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        
        setFrames(prev => {
          const combined = [...prev, ...batch];
          if (combined.length >= MAX_FRAME_LIMIT) {
            handleSaveTrace(combined);
            return [];
          }
          return combined;
        });

        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => {
          const rawHex = f.id.replace('0x', '');
          const normId = normalizeId(rawHex, true);
          latest[normId] = f;
        });

        setLatestFrames(prev => ({ ...prev, ...latest }));
        setHwStatus('active');
        lastUpdateRef.current = now;
      }
      animationFrame = requestAnimationFrame(processBatch);
    };
    animationFrame = requestAnimationFrame(processBatch);
    return () => cancelAnimationFrame(animationFrame);
  }, [handleSaveTrace]);

  const disconnectHardware = async () => {
    if (btDeviceRef.current) {
      if (btDeviceRef.current.gatt.connected) btDeviceRef.current.gatt.disconnect();
      btDeviceRef.current = null;
    }
    if (socketRef.current) socketRef.current.close();
    if (serialReaderRef.current) {
      try { await serialReaderRef.current.cancel(); serialReaderRef.current.releaseLock(); } catch {}
    }
    if (serialPortRef.current) { try { await serialPortRef.current.close(); } catch {} }
    setBridgeStatus('disconnected');
    setHwStatus('offline');
    addDebugLog("Link Disconnected.");
  };

  const connectESP32Serial = async () => {
    if (!('serial' in navigator)) {
      addDebugLog("Error: Browser does not support Web Serial.");
      return;
    }
    try {
      setBridgeStatus('connecting');
      addDebugLog("Requesting Serial Port access...");
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: baudRate, dtr: true, rts: true });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      sessionStartTimeRef.current = performance.now();
      addDebugLog("Serial Port Opened. Handshake Success.");
      
      const decoder = new TextDecoder();
      let buffer = '';
      const reader = port.readable.getReader();
      serialReaderRef.current = reader;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setRxByteCount(prev => prev + value.length);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) parseESP32Line(line);
        }
      }
    } catch (err: any) { 
      addDebugLog(`Link Error: ${err.message}`);
      setBridgeStatus('error'); 
      disconnectHardware(); 
    }
  };

  const connectESP32Bluetooth = async () => {
    // Fixed: Cast navigator to any to check for bluetooth property as it's not in standard Navigator type
    if (!(navigator as any).bluetooth) {
      addDebugLog("Error: Browser does not support Web Bluetooth.");
      return;
    }
    try {
      setBridgeStatus('connecting');
      addDebugLog("Searching for OSM_CAN_BT devices...");
      
      // Fixed: Cast navigator to any to call bluetooth.requestDevice
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'OSM_CAN' }],
        optionalServices: [UART_SERVICE_UUID]
      });

      btDeviceRef.current = device;
      addDebugLog(`Found ${device.name}. Connecting to GATT Server...`);
      
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);
      
      setBridgeStatus('connected');
      sessionStartTimeRef.current = performance.now();
      addDebugLog("Bluetooth GATT Connected. Monitoring Stream...");

      const decoder = new TextDecoder();
      let buffer = '';

      characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        setRxByteCount(prev => prev + value.byteLength);
        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) parseESP32Line(line);
        }
      });

      device.addEventListener('gattserverdisconnected', () => {
        addDebugLog("Bluetooth Link Lost.");
        disconnectHardware();
      });

    } catch (err: any) {
      addDebugLog(`BT Error: ${err.message}`);
      setBridgeStatus('error');
      disconnectHardware();
    }
  };

  const connectBridge = useCallback(() => {
    if (hardwareMode === 'pcan') {
       addDebugLog("PCAN mode not implemented in this bridge version.");
    } else if (hardwareMode === 'esp32-serial') {
       connectESP32Serial();
    } else if (hardwareMode === 'esp32-bt') {
       connectESP32Bluetooth();
    }
  }, [hardwareMode, baudRate, handleNewFrame]);

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <h1 className="text-8xl font-orbitron font-black text-slate-900 uppercase">OSM <span className="text-indigo-600">LIVE</span></h1>
        <button onClick={() => setView('live')} className="mt-16 px-16 py-6 bg-indigo-600 text-white rounded-2xl font-orbitron font-black uppercase shadow-2xl hover:bg-indigo-700 transition-all">
          Launch HUD
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
      <header className="h-20 border-b flex items-center justify-between px-10 bg-white/90 backdrop-blur-xl z-[70]">
        <div className="flex items-center gap-6">
          <button onClick={() => { disconnectHardware(); setView('home'); }} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1.5">
            {['link', 'trace', 'library', 'analysis'].map((tab) => (
              <button key={tab} onClick={() => setDashboardTab(tab as any)} className={`px-6 py-2 rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest transition-all ${dashboardTab === tab ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-mono text-[10px] font-bold ${
            bridgeStatus === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
            bridgeStatus === 'connecting' ? 'bg-blue-50 text-blue-600 border-blue-100' :
            bridgeStatus === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
            'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            {bridgeStatus.toUpperCase()}
          </div>
          <button onClick={() => setIsPaused(!isPaused)} className={`px-8 py-3 rounded-2xl text-[10px] font-orbitron font-black uppercase tracking-widest ${isPaused ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        {dashboardTab === 'link' ? (
          <ConnectionPanel 
            status={bridgeStatus} hwStatus={hwStatus} hardwareMode={hardwareMode}
            onSetHardwareMode={setHardwareMode} baudRate={baudRate} setBaudRate={setBaudRate}
            onConnect={connectBridge} onDisconnect={disconnectHardware} debugLog={debugLog}
          />
        ) : dashboardTab === 'analysis' ? (
          <TraceAnalysisDashboard frames={frames} library={library} />
        ) : dashboardTab === 'trace' ? (
          <CANMonitor 
            frames={frames} 
            isPaused={isPaused} 
            library={library} 
            onSaveTrace={() => handleSaveTrace(frames)}
            isSaving={isSaving}
          />
        ) : (
          <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
        )}
      </main>

      <footer className="h-12 border-t bg-white px-10 flex items-center justify-between text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <Power size={12} className={hwStatus === 'active' ? 'text-indigo-600' : 'text-slate-300'} />
              <span>LINK: <span className={hwStatus === 'active' ? 'text-emerald-500' : 'text-slate-400'}>{hwStatus.toUpperCase()}</span></span>
            </div>
            <div className="flex items-center gap-3">
              <Activity size={12} className="text-indigo-600" />
              <span>BYTES_RX: <span className="text-slate-800">{rxByteCount.toLocaleString()}</span></span>
            </div>
            <div className="flex items-center gap-3">
              <Database size={12} className="text-indigo-600" />
              <span>BUFFER: <span className={`${frames.length > (MAX_FRAME_LIMIT * 0.9) ? 'text-amber-500 font-bold' : 'text-slate-800'}`}>{frames.length.toLocaleString()} / {MAX_FRAME_LIMIT.toLocaleString()}</span></span>
            </div>
          </div>
          <div>OSM_STABLE_V12.0_BT</div>
      </footer>
    </div>
  );
};

export default App;
