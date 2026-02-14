
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2, Smartphone, Tablet, Monitor, LineChart as ChartIcon, Info, HelpCircle, AlertTriangle } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import LiveVisualizerDashboard from '@/components/LiveVisualizerDashboard';
import AuthScreen from '@/components/AuthScreen';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary, SignalAnalysis, DBCMessage, DBCSignal } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay, decodeSignal, cleanMessageName } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';
import { analyzeCANData } from '@/services/geminiService';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 
const STALE_SIGNAL_TIMEOUT = 5000; 

// Nordic UART Service UUIDs
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('osm_currentUser');
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });
  
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('osm_sid'));
  const [view, setView] = useState<'home' | 'live'>('home');
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis' | 'live-visualizer'>('link');
  const [hardwareMode, setHardwareMode] = useState<'esp32-serial' | 'esp32-bt'>('esp32-bt');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDecoded, setIsSavingDecoded] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // Persistent analysis states
  const [analysisSelectedSignals, setAnalysisSelectedSignals] = useState<string[]>([]);
  const [visualizerSelectedSignals, setVisualizerSelectedSignals] = useState<string[]>([]);
  const [watcherActive, setWatcherActive] = useState(false);
  const [lastAiAnalysis, setLastAiAnalysis] = useState<(SignalAnalysis & { isAutomatic?: boolean }) | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
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
  const serialReaderRef = useRef<any>(null);
  const webBluetoothDeviceRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const triggerAiAnalysis = async (isAuto = false) => {
    if (frames.length === 0) return;
    setAiLoading(true);
    try {
      const result = await analyzeCANData(frames, user || undefined, sessionId || undefined);
      setLastAiAnalysis({ ...result, isAutomatic: isAuto });
    } catch (e) {
      addDebugLog("AI_ERROR: Analysis failed.");
    } finally {
      setAiLoading(false);
    }
  };

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

  /**
   * WEB BLUETOOTH HANDLER - DESKTOP RELIABILITY FIX
   */
  const connectWebBluetooth = async () => {
    if (!(navigator as any).bluetooth) {
      addDebugLog("ERROR: Browser does not support Web Bluetooth.");
      setBridgeStatus('error');
      return;
    }

    try {
      // 1. Force cleanup of previous session
      if (webBluetoothDeviceRef.current && webBluetoothDeviceRef.current.gatt.connected) {
        addDebugLog("SCAN: Closing existing link...");
        await webBluetoothDeviceRef.current.gatt.disconnect();
      }

      setBridgeStatus('connecting');
      addDebugLog("SCAN: Requesting Device...");
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [UART_SERVICE_UUID] }],
        optionalServices: [UART_SERVICE_UUID]
      });

      webBluetoothDeviceRef.current = device;
      addDebugLog(`LINK: Connecting to ${device.name || 'OSM Hardware'}...`);

      device.addEventListener('gattserverdisconnected', () => {
        addDebugLog("LINK: Device lost connection.");
        setBridgeStatus('disconnected');
        setHwStatus('offline');
      });

      // 2. GATT Handshake with stabilization
      const server = await device.gatt.connect();
      addDebugLog("LINK: GATT connected. Cooling (1000ms)...");
      await new Promise(r => setTimeout(r, 1000));
      
      addDebugLog("LINK: Searching for Data Channel...");
      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(TX_CHAR_UUID);

      addDebugLog("LINK: Subscribing to CAN stream...");
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);
        
        bleBufferRef.current += chunk;
        if (bleBufferRef.current.includes('\n')) {
          const lines = bleBufferRef.current.split('\n');
          bleBufferRef.current = lines.pop() || "";
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || !cleanLine.includes('#')) continue;
            const parts = cleanLine.split('#');
            if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
        }
      });

      setFrames([]);
      setLatestFrames({});
      frameMapRef.current.clear();
      
      setBridgeStatus('connected');
      setHwStatus('active');
      addDebugLog("BRIDGE: Secure Desktop Link Established.");

    } catch (err: any) {
      addDebugLog(`BLE_FAULT: ${err.message}`);
      setBridgeStatus('disconnected');
      
      if (err.name === 'NetworkError' || err.message.includes('GATT')) {
        addDebugLog("DESKTOP_FIX: Go to Windows/macOS Settings, UNPAIR the device, and try again.");
      }
    }
  };

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = performance.now();
      setLatestFrames(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].timestamp > STALE_SIGNAL_TIMEOUT) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // Native Mobile Bridge Listeners
  useEffect(() => {
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(msg);
    (window as any).onNativeBleStatus = (status: string) => {
      setBridgeStatus(status as ConnectionStatus);
      if (status === 'connected') {
          setHwStatus('active');
          setFrames([]);
          setLatestFrames({});
          frameMapRef.current.clear();
      }
    };
    (window as any).onNativeBleData = (chunk: string) => {
      bleBufferRef.current += chunk;
      if (bleBufferRef.current.includes('\n')) {
        const lines = bleBufferRef.current.split('\n');
        bleBufferRef.current = lines.pop() || "";
        for (const line of lines) {
          const parts = line.trim().split('#');
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
    addDebugLog("SYS: Closing all links...");

    if (webBluetoothDeviceRef.current?.gatt.connected) {
      await webBluetoothDeviceRef.current.gatt.disconnect();
    }

    if ((window as any).NativeBleBridge) {
      (window as any).NativeBleBridge.disconnectBle();
    }

    setBridgeStatus('disconnected');
    setHwStatus('offline');
    addDebugLog("SYS: Hardware offline.");
  }, [addDebugLog]);

  const handleConnect = () => {
    if (hardwareMode === 'esp32-bt') {
      if ((window as any).NativeBleBridge) {
        setBridgeStatus('connecting');
        (window as any).NativeBleBridge.startBleLink();
      } else {
        connectWebBluetooth();
      }
    } else {
      addDebugLog("ERROR: Serial mode not configured in this build.");
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        setFrames(prev => [...prev, ...batch]);
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => { latest[normalizeId(f.id.replace('0x',''), true)] = f; });
        setLatestFrames(prev => ({ ...prev, ...latest }));
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleAuthenticated = (u: User, s: string) => {
    localStorage.setItem('osm_currentUser', JSON.stringify(u));
    localStorage.setItem('osm_sid', s);
    setUser(u);
    setSessionId(s);
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div className="h-screen w-full font-inter">
      {view === 'home' ? (
        <div className="h-full w-full flex flex-col items-center justify-center bg-white px-6 relative overflow-hidden">
          <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
          <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
          <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center relative z-10">
            <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex flex-col bg-slate-50 safe-pt overflow-hidden relative">
          <header className="h-14 md:h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-[100]">
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setView('home')} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={18} /></button>
              <h2 className="text-[10px] md:text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
            </div>
          </header>

          <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
            {dashboardTab === 'link' ? (
              <ConnectionPanel 
                status={bridgeStatus} 
                hardwareMode={hardwareMode} 
                // Fix: changed onSetHardwareMode={onSetHardwareMode} to onSetHardwareMode={setHardwareMode}
                onSetHardwareMode={setHardwareMode} 
                baudRate={baudRate} 
                setBaudRate={setBaudRate} 
                onConnect={handleConnect} 
                onDisconnect={disconnectHardware} 
                debugLog={debugLog}
              />
            ) : dashboardTab === 'analysis' ? (
              <TraceAnalysisDashboard 
                frames={frames} 
                library={library} 
                latestFrames={latestFrames} 
                selectedSignalNames={analysisSelectedSignals}
                setSelectedSignalNames={setAnalysisSelectedSignals}
                watcherActive={watcherActive}
                setWatcherActive={setWatcherActive}
                lastAiAnalysis={lastAiAnalysis}
                aiLoading={aiLoading}
                onManualAnalyze={() => triggerAiAnalysis(false)}
              />
            ) : dashboardTab === 'live-visualizer' ? (
              <LiveVisualizerDashboard 
                frames={frames} 
                library={library} 
                latestFrames={latestFrames} 
                selectedSignalNames={visualizerSelectedSignals}
                setSelectedSignalNames={setVisualizerSelectedSignals}
              />
            ) : dashboardTab === 'trace' ? (
              <div className="flex-1 flex flex-col overflow-hidden p-2 md:p-4 gap-4">
                 <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} />
              </div>
            ) : (
              <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
            )}
          </main>

          <nav className="h-16 md:h-20 bg-white border-t flex items-center justify-around px-2 md:px-4 pb-1 md:pb-2 shrink-0 safe-pb z-[100]">
            {[
                { id: 'link', icon: Bluetooth, label: 'LINK' },
                { id: 'trace', icon: LayoutDashboard, label: 'HUD' },
                { id: 'library', icon: Database, label: 'DATA' },
                { id: 'live-visualizer', icon: ChartIcon, label: 'LIVE' },
                { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                    <tab.icon size={18} /><span className="text-[7px] md:text-[8px] font-orbitron font-black uppercase tracking-tighter md:tracking-normal">{tab.label}</span>
                </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
};

export default App;
