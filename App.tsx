
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import AuthScreen from '@/components/AuthScreen';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay } from '@/utils/decoder';
import { User, authService, SPREADSHEET_URL } from '@/services/authService';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 
const SESSION_HEARTBEAT_INTERVAL = 5000; // 5-second "CONFLICT DETECTION"

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

  // Handle Session Persistence
  useEffect(() => {
    const stored = localStorage.getItem('osm_currentUser');
    const storedSid = localStorage.getItem('osm_sid');
    if (stored && storedSid) {
      setUser(JSON.parse(stored));
      setSessionId(storedSid);
    }
  }, []);

  /**
   * THE 5-SECOND HEARTBEAT
   * Implements "Automatic Boot" if Cloud SID mismatches.
   */
  useEffect(() => {
    if (!user || !sessionId) return;

    const interval = setInterval(async () => {
      const remoteSid = await authService.fetchRemoteSessionId(user.email);
      // Conflict detection: if remote exists and is different from local
      if (remoteSid !== "NOT_FOUND" && remoteSid !== "ERROR" && remoteSid !== sessionId) {
        alert("⚠️ SESSION TERMINATED:\nYour account was logged in from another device.\nAccess has been revoked locally.");
        handleLogout();
      }
    }, SESSION_HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [user, sessionId]);

  const handleAuth = (userData: User, sid: string) => {
    setUser(userData);
    setSessionId(sid);
    localStorage.setItem('osm_currentUser', JSON.stringify(userData));
    localStorage.setItem('osm_sid', sid);
  };

  const handleLogout = () => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setView('home');
    disconnectHardware();
  };

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
        } catch (e) { addDebugLog(`NATIVE_ERROR: ${e}`); }
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

  const connectSerial = async () => {
    if (!("serial" in navigator)) return;
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
              if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
            }
          }
        } finally { serialReaderRef.current.releaseLock(); }
      }
    } catch (err) { setBridgeStatus('disconnected'); }
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

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuth} />;
  }

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6">
        <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
        <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
        <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">Operator: {user.userName}</p>
          <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
          <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-red-500 transition-colors">
            <LogOut size={16} /> Terminate Terminal Session
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
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('home')} className="p-2"><ArrowLeft size={20} /></button>
          <div className="flex flex-col">
            <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
            <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest">{user.userName} / {sessionId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex flex-col items-end">
              <span className="text-[7px] font-black text-slate-400 uppercase">Security_Heartbeat</span>
              <span className="text-[8px] font-bold text-emerald-500 uppercase animate-pulse">Synchronized</span>
           </div>
           <div className={`w-3 h-3 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-300'}`} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {dashboardTab === 'link' ? (
          <ConnectionPanel 
            status={bridgeStatus} 
            hwStatus={hwStatus} 
            hardwareMode={hardwareMode}
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
          <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} onSaveTrace={() => generateTraceFile(frames, false)} isSaving={isSaving} />
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
            <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-400'}`}>
                <tab.icon size={20} /><span className="text-[8px] font-orbitron font-black uppercase">{tab.label}</span>
            </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
