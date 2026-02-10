
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2, Smartphone, Tablet, Monitor } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import AuthScreen from '@/components/AuthScreen';
import SignalGauges from '@/components/SignalGauges';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay, decodeSignal } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';

const MAX_FRAME_LIMIT = 50000; 
const BATCH_UPDATE_INTERVAL = 60; 

type PreviewMode = 'full' | 'mobile' | 'tablet';

const App: React.FC = () => {
  // Initialize state from localStorage to prevent auto-logout
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('osm_currentUser');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return localStorage.getItem('osm_sid');
  });

  const [view, setView] = useState<'home' | 'live'>('home');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('full');
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis'>('link');
  const [hardwareMode, setHardwareMode] = useState<'pcan' | 'esp32-serial' | 'esp32-bt'>('pcan');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  
  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });

  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const bleBufferRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[]) => {
    if (isPaused) return;
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
  }, [isPaused]);

  // NATIVE BRIDGE REGISTRATION
  useEffect(() => {
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(msg);
    (window as any).onNativeBleStatus = (status: string) => {
      setBridgeStatus(status as ConnectionStatus);
      if (status === 'connected') {
          setHwStatus('active');
          setSimulationEnabled(false);
      }
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

  // SIMULATION GENERATOR
  useEffect(() => {
    if (!simulationEnabled || bridgeStatus === 'connected' || bridgeStatus === 'connecting') return;
    const interval = setInterval(() => {
        const mock = generateMockPacket(frameMapRef.current, performance.now());
        handleNewFrame(mock.id.replace('0x',''), mock.dlc, mock.data);
    }, 500);
    return () => clearInterval(interval);
  }, [simulationEnabled, bridgeStatus, handleNewFrame]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
        addDebugLog("ERROR: Serial API not supported in this browser.");
        setBridgeStatus('error');
        return;
    }
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      setSimulationEnabled(false);
      keepReadingRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";
      
      const reader = port.readable.getReader();
      try {
        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
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
      } finally {
        reader.releaseLock();
      }
    } catch (err: any) { 
      setBridgeStatus('disconnected'); 
      addDebugLog(`SERIAL_FAULT: ${err.message}`);
    }
  };

  const disconnectHardware = useCallback(async () => {
    keepReadingRef.current = false;
    if (serialPortRef.current) {
      try { await serialPortRef.current.close(); } catch (e) {}
      serialPortRef.current = null;
    }
    if ((window as any).NativeBleBridge) (window as any).NativeBleBridge.disconnectBle();
    setBridgeStatus('disconnected');
    setHwStatus('offline');
    setSimulationEnabled(true);
  }, []);

  const handleConnect = () => {
    setSimulationEnabled(false);
    frameMapRef.current.clear();
    setFrames([]);
    
    if (hardwareMode === 'esp32-bt') {
        setBridgeStatus('connecting');
        (window as any).NativeBleBridge?.startBleLink();
    } else {
        // Handle PCAN or ESP32-Wired via Serial
        connectSerial();
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

  const handleLogout = () => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setView('home');
    disconnectHardware();
  };

  // Persist session to localStorage when user logs in
  const handleAuthenticated = (u: User, s: string) => {
    localStorage.setItem('osm_currentUser', JSON.stringify(u));
    localStorage.setItem('osm_sid', s);
    setUser(u);
    setSessionId(s);
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const PreviewToggle = () => (
    <div className="absolute top-6 right-6 z-[200] flex items-center gap-1 bg-white/80 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-slate-200">
      <button 
        onClick={() => setPreviewMode('full')}
        className={`p-2 rounded-full transition-all ${previewMode === 'full' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
        title="Responsive View"
      >
        <Monitor size={18} />
      </button>
      <button 
        onClick={() => setPreviewMode('tablet')}
        className={`p-2 rounded-full transition-all ${previewMode === 'tablet' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
        title="Tablet Preview"
      >
        <Tablet size={18} />
      </button>
      <button 
        onClick={() => setPreviewMode('mobile')}
        className={`p-2 rounded-full transition-all ${previewMode === 'mobile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
        title="Mobile Preview"
      >
        <Smartphone size={18} />
      </button>
    </div>
  );

  const renderContent = () => {
    if (view === 'home') {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-white px-6 relative overflow-hidden">
          <PreviewToggle />
          <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
          <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
          <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center relative z-10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">Operator: {user.userName}</p>
            <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
            <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">Terminate Session</button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full flex flex-col bg-slate-50 safe-pt overflow-hidden relative">
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
               <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} />
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

  // Device Frame Wrapper Logic
  if (previewMode === 'full') {
    return <div className="h-screen w-full">{renderContent()}</div>;
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-200 overflow-hidden p-4 lg:p-12 relative">
      {/* Background Grid for preview mode focus */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, #4f46e5 1px, transparent 1px), linear-gradient(to bottom, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>
      
      {/* Dynamic Selector remains floating on top */}
      <PreviewToggle />

      <div 
        className={`relative bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-8 border-slate-900 transition-all duration-500 ease-in-out flex flex-col
          ${previewMode === 'mobile' ? 'w-[375px] h-[812px] rounded-[3rem]' : 'w-[820px] h-[1080px] rounded-[2rem]'}`}
      >
        {/* Device Features (Speaker/Camera) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-2xl z-[250] flex items-center justify-center gap-2">
            <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
            <div className="w-2 h-2 bg-slate-800 rounded-full"></div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-900/10 rounded-full z-[250]"></div>
      </div>
    </div>
  );
};

export default App;
