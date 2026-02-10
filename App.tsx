
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2 } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import AuthScreen from '@/components/AuthScreen';
import SignalGauges from '@/components/SignalGauges';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay, decodeSignal } from '@/utils/decoder';
import { User, authService, SPREADSHEET_URL } from '@/services/authService';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 
const SESSION_HEARTBEAT_INTERVAL = 5000; 

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'live'>('home');
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis'>('link');
  const [hardwareMode, setHardwareMode] = useState<'pcan' | 'esp32-serial' | 'esp32-bt'>('pcan');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });

  const isAdmin = useMemo(() => user ? authService.isAdmin(user.email) : false, [user]);

  useEffect(() => {
    if (bridgeStatus === 'connected' && dashboardTab === 'link') {
        setDashboardTab('trace');
    }
  }, [bridgeStatus, dashboardTab]);

  useEffect(() => {
    const stored = localStorage.getItem('osm_currentUser');
    const storedSid = localStorage.getItem('osm_sid');
    if (stored && storedSid) {
      setUser(JSON.parse(stored));
      setSessionId(storedSid);
    }
  }, []);

  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const isPausedRef = useRef(isPaused);
  const bleBufferRef = useRef<string>("");
  
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

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
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(msg);
    (window as any).onNativeBleStatus = (status: string) => {
      setBridgeStatus(status as ConnectionStatus);
      if (status === 'connected') setHwStatus('active');
      else if (status === 'error') setHwStatus('fault');
      else setHwStatus('offline');
    };
    (window as any).onNativeBleData = (chunk: string) => {
      bleBufferRef.current += chunk;
      if (bleBufferRef.current.includes('\n')) {
        const lines = bleBufferRef.current.split('\n');
        bleBufferRef.current = lines.pop() || "";
        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          const parts = cleanLine.split('#');
          if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
        }
      }
    };
    return () => {
      delete (window as any).onNativeBleLog;
      delete (window as any).onNativeBleStatus;
      delete (window as any).onNativeBleData;
    };
  }, [addDebugLog, handleNewFrame]);

  const disconnectHardware = useCallback(async () => {
    keepReadingRef.current = false;
    if (serialReaderRef.current) try { await serialReaderRef.current.cancel(); } catch (e) {}
    if (serialPortRef.current) {
      try { await serialPortRef.current.close(); } catch (e) {}
      serialPortRef.current = null;
    }
    if ((window as any).NativeBleBridge) (window as any).NativeBleBridge.disconnectBle();
    setBridgeStatus('disconnected');
    setHwStatus('offline');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setView('home');
    disconnectHardware();
  }, [disconnectHardware]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
        addDebugLog("ERROR: Serial API not supported in this browser.");
        return;
    }
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      keepReadingRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";
      while (port.readable && keepReadingRef.current) {
        serialReaderRef.current = port.readable.getReader();
        try {
          while (keepReadingRef.current) {
            const { value, done } = await serialReaderRef.current.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine) continue;
              const parts = cleanLine.split('#');
              if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
            }
          }
        } catch (err: any) {
          if (keepReadingRef.current) addDebugLog(`SERIAL_ERROR: ${err.message}`);
        } finally { 
          serialReaderRef.current.releaseLock();
          serialReaderRef.current = null;
        }
      }
    } catch (err: any) { 
      setBridgeStatus('disconnected'); 
      addDebugLog(`SERIAL_FAULT: ${err.message}`);
    }
  };

  const handleConnect = () => {
    if (hardwareMode === 'esp32-serial' || hardwareMode === 'pcan') connectSerial();
    else if (hardwareMode === 'esp32-bt') {
        setBridgeStatus('connecting');
        (window as any).NativeBleBridge?.startBleLink();
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        setFrames(prev => prev.length + batch.length >= MAX_FRAME_LIMIT ? [] : [...prev, ...batch]);
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => { latest[normalizeId(f.id.replace('0x',''), true)] = f; });
        setLatestFrames(prev => ({ ...prev, ...latest }));
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const gaugeData = useMemo(() => {
    const result = [];
    for (let i = Math.max(0, frames.length - 50); i < frames.length; i++) {
      const f = frames[i];
      let rpm = 0, temp = 0, throttle = 0;
      const normId = normalizeId(f.id.replace('0x', ''), true);
      if (normId === "18275040") rpm = parseFloat(decodeSignal(f.data, library.database["2552713280"]?.signals["MCU_Motor_RPM"]));
      if (normId === "18265040") {
        temp = parseFloat(decodeSignal(f.data, library.database["2552647744"]?.signals["MCU_Motor_Temperature"]));
        throttle = parseFloat(decodeSignal(f.data, library.database["2552647744"]?.signals["sigThrottle"]));
      }
      result.push({ rpm, temp, throttle, timestamp: f.timestamp });
    }
    return result;
  }, [frames, library.database]);

  if (!user) return <AuthScreen onAuthenticated={(u, s) => { setUser(u); setSessionId(s); localStorage.setItem('osm_currentUser', JSON.stringify(u)); localStorage.setItem('osm_sid', s); }} />;

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6">
        <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
        <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">Operator: {user.userName}</p>
          <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
          <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">Terminate Session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 safe-pt">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0 z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
        </div>
        <div className={`w-3 h-3 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : bridgeStatus === 'error' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-slate-300'}`} />
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {dashboardTab === 'link' ? (
          <ConnectionPanel 
            status={bridgeStatus} 
            hwStatus={hwStatus} 
            hardwareMode={hardwareMode}
            onSetHardwareMode={setHardwareMode} 
            baudRate={baudRate} 
            setBaudRate={setBaudRate}
            onConnect={handleConnect} 
            onDisconnect={disconnectHardware} 
            debugLog={debugLog}
          />
        ) : dashboardTab === 'analysis' ? (
          <TraceAnalysisDashboard frames={frames} library={library} />
        ) : dashboardTab === 'trace' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
             <SignalGauges data={gaugeData} />
             <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} onSaveTrace={() => {}} isSaving={isSaving} />
          </div>
        ) : (
          <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
        )}
      </main>

      <nav className="h-20 bg-white border-t flex items-center justify-around px-4 pb-2 shrink-0 safe-pb z-[100]">
        {[
            { id: 'link', icon: Bluetooth, label: 'LINK' },
            { id: 'trace', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'library', icon: Database, label: 'DATA' },
            { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
        ].map(tab => (
            <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                <tab.icon size={20} /><span className="text-[8px] font-orbitron font-black uppercase">{tab.label}</span>
            </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
