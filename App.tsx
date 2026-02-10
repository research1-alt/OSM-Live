
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
  // GATEWAY LOGIC: Default to 'link' manager
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
  const prevBridgeStatus = useRef<ConnectionStatus>('disconnected');

  // REDIRECT LOGIC: Only auto-redirect once upon connection or disconnection
  useEffect(() => {
    // 1. If connection drops, force user back to LINK tab
    if (bridgeStatus !== 'connected' && dashboardTab !== 'link') {
      setDashboardTab('link');
    }
    
    // 2. AUTOMATIC ROUTING: If we JUST transitioned to 'connected', move to 'trace'
    // This only happens on the transition, allowing the user to click back to 'link' manually later.
    if (bridgeStatus === 'connected' && prevBridgeStatus.current !== 'connected') {
        setDashboardTab('trace');
    }
    
    prevBridgeStatus.current = bridgeStatus;
  }, [bridgeStatus]);

  useEffect(() => {
    const stored = localStorage.getItem('osm_currentUser');
    const storedSid = localStorage.getItem('osm_sid');
    if (stored && storedSid) {
      setUser(JSON.parse(stored));
      setSessionId(storedSid);
    }

    setTimeout(() => {
        const isNative = !!(window as any).NativeBleBridge;
        addDebugLog(`SYS: Native Bridge Detected: ${isNative ? 'YES' : 'NO'}`);
    }, 2000);
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
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(`BLE: ${msg}`);
    
    (window as any).onNativeBleStatus = (status: string) => {
      setBridgeStatus(status as ConnectionStatus);
      if (status === 'connected') setHwStatus('active');
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
          if (parts.length >= 3) {
            handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
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
    
    if (serialReaderRef.current) {
      try {
        await serialReaderRef.current.cancel();
      } catch (e) {}
    }

    if (serialPortRef.current) {
      try {
        await serialPortRef.current.close();
        addDebugLog("SYS: Serial Port Closed");
      } catch (e: any) {
        addDebugLog(`ERROR_CLOSING: ${e.message}`);
      }
      serialPortRef.current = null;
    }

    if ((window as any).NativeBleBridge) {
        (window as any).NativeBleBridge.disconnectBle();
    }
    setBridgeStatus('disconnected');
    setHwStatus('offline');
  }, [addDebugLog]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setView('home');
    disconnectHardware();
  }, [disconnectHardware]);

  useEffect(() => {
    if (!user || !sessionId) return;
    if (isAdmin) return;

    const interval = setInterval(async () => {
      const remoteSid = await authService.fetchRemoteSessionId(user.email);
      if (remoteSid !== "NOT_FOUND" && remoteSid !== "ERROR" && remoteSid !== sessionId) {
        alert("⚠️ SESSION CONFLICT:\nAccess revoked due to login on another device.");
        handleLogout();
      }
    }, SESSION_HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [user, sessionId, isAdmin, handleLogout]);

  const handleAuth = (userData: User, sid: string) => {
    setUser(userData);
    setSessionId(sid);
    localStorage.setItem('osm_currentUser', JSON.stringify(userData));
    localStorage.setItem('osm_sid', sid);
  };

  const generateTraceFile = useCallback((framesToSave: CANFrame[], isAuto: boolean = false) => {
    if (!framesToSave || framesToSave.length === 0) return;
    setIsSaving(true);
    const startTime = new Date().toISOString();
    const fileName = `OSM_Trace_${isAuto ? 'Auto' : 'Manual'}_${Date.now()}.trc`;
    
    const lines: string[] = [];
    lines.push(`$VERSION=1.1`);
    lines.push(`$STARTTIME=${startTime}`);
    lines.push(`; Log Type: ${isAuto ? 'AUTO_ROLLOVER' : 'MANUAL_EXPORT'}`);
    lines.push(`; Operator: ${user?.userName || 'UNKNOWN'}`);
    lines.push(`; Session: ${sessionId || 'N/A'}`);
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
    const nativeInterface = (window as any).AndroidInterface;
    if (nativeInterface && nativeInterface.saveFile) {
        try {
            nativeInterface.saveFile(content, fileName);
            setIsSaving(false);
            return;
        } catch (e) { addDebugLog(`NATIVE_SAVE_ERROR: ${e}`); }
    }

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsSaving(false);
      }, 2000);
    } catch (err) { setIsSaving(false); }
  }, [user, sessionId, addDebugLog]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        setFrames(prev => {
          if (prev.length + batch.length >= MAX_FRAME_LIMIT) {
            generateTraceFile([...prev, ...batch], true);
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
  }, [generateTraceFile]);

  const gaugeData = useMemo(() => {
    const result = [];
    const windowSize = 50;
    for (let i = Math.max(0, frames.length - windowSize); i < frames.length; i++) {
      const f = frames[i];
      let rpm = 0;
      let temp = 0;
      let throttle = 0;
      const normId = normalizeId(f.id.replace('0x', ''), true);
      
      if (normId === "18275040") {
        const sig = library.database["2552713280"]?.signals["MCU_Motor_RPM"];
        if (sig) rpm = parseFloat(decodeSignal(f.data, sig));
      }
      if (normId === "18265040") {
        const tempSig = library.database["2552647744"]?.signals["MCU_Motor_Temperature"];
        const throttleSig = library.database["2552647744"]?.signals["sigThrottle"];
        if (tempSig) temp = parseFloat(decodeSignal(f.data, tempSig));
        if (throttleSig) throttle = parseFloat(decodeSignal(f.data, throttleSig));
      }
      result.push({ rpm, temp, throttle, timestamp: f.timestamp });
    }
    return result;
  }, [frames, library.database]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
        addDebugLog("SYS: Serial API not supported in this browser.");
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
          if (keepReadingRef.current) addDebugLog(`SERIAL_READ_ERROR: ${err.message}`);
        } finally { 
          serialReaderRef.current.releaseLock();
          serialReaderRef.current = null;
        }
      }
    } catch (err: any) { 
      setBridgeStatus('disconnected'); 
      addDebugLog(`SERIAL_ERROR: ${err.message}`);
    }
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuth} />;

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6">
        <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
        <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center">
          <div className="flex flex-col items-center gap-1 mb-4">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Operator: {user.userName}</p>
             {isAdmin && (
               <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 shadow-sm mt-1">
                 <ShieldCheck size={12} />
                 <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">ADMIN_PRIVILEGED</span>
               </div>
             )}
          </div>
          <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
          <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-red-500 transition-colors">
            <LogOut size={16} /> Terminate Session
          </button>
          <a href={SPREADSHEET_URL} target="_blank" rel="noopener noreferrer" className="mt-8 text-[8px] text-slate-300 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-indigo-400 transition-colors">
            <ExternalLink size={10} /> View Cloud Registry
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 safe-pt">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0 z-[100]">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
              {isAdmin && <span className="bg-indigo-600 text-white text-[7px] font-orbitron font-black px-1.5 py-0.5 rounded leading-none">ADMIN</span>}
            </div>
            <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest">{user.userName}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {bridgeStatus === 'connected' && (
               <button 
                 onClick={() => setDashboardTab('link')} 
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[8px] font-orbitron font-black uppercase transition-all shadow-sm ${dashboardTab === 'link' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
               >
                 <Settings2 size={12} />
                 Link_Settings
               </button>
           )}
           <div className={`w-3 h-3 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-300'}`} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {dashboardTab === 'link' ? (
          <ConnectionPanel 
            status={bridgeStatus} 
            hwStatus={hwStatus} 
            hardwareMode={hardwareMode}
            onSetHardwareMode={setHardwareMode} 
            baudRate={baudRate} 
            setBaudRate={setBaudRate}
            onConnect={() => {
                if (hardwareMode === 'esp32-serial') connectSerial();
                else if (hardwareMode === 'esp32-bt') (window as any).NativeBleBridge?.startBleLink();
                else addDebugLog("SYS: Selected mode requires external bridge.");
            }} 
            onDisconnect={disconnectHardware} 
            debugLog={debugLog}
          />
        ) : dashboardTab === 'analysis' ? (
          <TraceAnalysisDashboard frames={frames} library={library} />
        ) : dashboardTab === 'trace' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
             <div className="shrink-0">
               <SignalGauges data={gaugeData} />
             </div>
             <div className="flex-1 overflow-hidden">
               <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} onSaveTrace={() => generateTraceFile(frames, false)} isSaving={isSaving} />
             </div>
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
        ].filter(tab => {
          if (bridgeStatus !== 'connected') {
            return tab.id === 'link';
          }
          return tab.id !== 'link';
        }).map(tab => (
            <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-400'}`}>
                <tab.icon size={20} /><span className="text-[8px] font-orbitron font-black uppercase">{tab.label}</span>
            </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
