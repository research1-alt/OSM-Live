
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw, Cpu, ArrowLeft, Download, FileUp, Loader2, Database, Activity, Zap, BarChart3, Settings2, ShieldAlert, Cable, AlertTriangle, Power, Save, Bluetooth, LayoutGrid, ListFilter } from 'lucide-react';
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

const MAX_FRAME_LIMIT = 5000;
const BATCH_UPDATE_INTERVAL = 60; 

const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('link');
  const [hardwareMode, setHardwareMode] = useState<HardwareMode>('pcan');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [pcanAddress, setPcanAddress] = useState('192.168.1.100:8080');
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

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

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
      addDebugLog(`HW: ${cleanLine}`);
      return;
    }
    const parts = cleanLine.split('#');
    if (parts.length >= 3) {
      const id = parts[0].trim();
      const dlc = parseInt(parts[1].trim());
      const data = parts[2].trim().split(/[, ]+/).filter(x => x.length > 0);
      if (id && !isNaN(dlc)) handleNewFrame(id, dlc, data);
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
          return combined.length >= MAX_FRAME_LIMIT ? combined.slice(-MAX_FRAME_LIMIT) : combined;
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
  }, []);

  const disconnectHardware = async () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (btDeviceRef.current) {
      if (btDeviceRef.current.gatt.connected) btDeviceRef.current.gatt.disconnect();
      btDeviceRef.current = null;
    }
    if (serialReaderRef.current) {
      try { await serialReaderRef.current.cancel(); serialReaderRef.current.releaseLock(); } catch {}
    }
    if (serialPortRef.current) { try { await serialPortRef.current.close(); } catch {} }
    setBridgeStatus('disconnected');
    setHwStatus('offline');
    addDebugLog("Link Disconnected.");
  };

  const connectPCANWebSocket = useCallback(() => {
    try {
      setBridgeStatus('connecting');
      const url = pcanAddress.startsWith('ws') ? pcanAddress : `ws://${pcanAddress}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setBridgeStatus('connected');
        addDebugLog(`PCAN Link Established: ${url}`);
        sessionStartTimeRef.current = performance.now();
      };

      socket.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // Expecting format: { id: "123", dlc: 8, data: ["AA", "BB"...] }
          if (raw.id && raw.data) {
            handleNewFrame(raw.id, raw.dlc || raw.data.length, raw.data);
          }
        } catch {
          // Fallback to line-based parsing if not JSON
          parseESP32Line(event.data);
        }
      };

      socket.onerror = () => {
        addDebugLog("PCAN WebSocket Error. Check Bridge IP.");
        setBridgeStatus('error');
      };

      socket.onclose = () => {
        if (bridgeStatus === 'connected') addDebugLog("PCAN Link Closed.");
        setBridgeStatus('disconnected');
      };

    } catch (err: any) {
      addDebugLog(`PCAN Init Error: ${err.message}`);
      setBridgeStatus('error');
    }
  }, [pcanAddress, addDebugLog, handleNewFrame, parseESP32Line, bridgeStatus]);

  const connectESP32Serial = async () => {
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: baudRate });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      sessionStartTimeRef.current = performance.now();
      const reader = port.readable.getReader();
      serialReaderRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setRxByteCount(prev => prev + value.length);
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) if (line.trim()) parseESP32Line(line);
      }
    } catch (err: any) { 
      addDebugLog(`Serial Error: ${err.message}`);
      setBridgeStatus('error'); 
      disconnectHardware(); 
    }
  };

  const connectESP32Bluetooth = async () => {
    try {
      setBridgeStatus('connecting');
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'OSM_CAN' }],
        optionalServices: [UART_SERVICE_UUID]
      });
      btDeviceRef.current = device;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(UART_TX_CHAR_UUID);
      setBridgeStatus('connected');
      sessionStartTimeRef.current = performance.now();
      const decoder = new TextDecoder();
      let buffer = '';
      characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        setRxByteCount(prev => prev + value.byteLength);
        buffer += decoder.decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) if (line.trim()) parseESP32Line(line);
      });
      device.addEventListener('gattserverdisconnected', () => disconnectHardware());
    } catch (err: any) {
      addDebugLog(`BT Error: ${err.message}`);
      setBridgeStatus('error');
      disconnectHardware();
    }
  };

  const connectBridge = useCallback(() => {
    if (hardwareMode === 'pcan') connectPCANWebSocket();
    else if (hardwareMode === 'esp32-serial') connectESP32Serial();
    else if (hardwareMode === 'esp32-bt') connectESP32Bluetooth();
  }, [hardwareMode, baudRate, connectPCANWebSocket]);

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6">
        <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce">
            <Cpu size={64} />
        </div>
        <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center leading-none">OSM <span className="text-indigo-600">LIVE</span></h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-4 mb-12">Tactical CAN Bus HUD for Mobile</p>
        <button onClick={() => setView('live')} className="w-full max-w-xs py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl hover:bg-indigo-700 transition-all active:scale-95">
          Launch Mobile HUD
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50 safe-pt">
      <header className="h-16 border-b flex items-center justify-between px-6 bg-white/95 backdrop-blur-xl z-[70] shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => { disconnectHardware(); setView('home'); }} className="p-2 hover:bg-slate-100 rounded-xl">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase tracking-tighter">OSM_MOBILE_LINK</h2>
        </div>
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${bridgeStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded-xl border ${isPaused ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button>
        </div>
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
            onConnect={connectBridge} 
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
            onSaveTrace={() => addDebugLog("Mobile save restricted to buffer")}
            isSaving={isSaving}
          />
        ) : (
          <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="h-20 bg-white border-t flex items-center justify-around px-4 pb-2 shrink-0 z-[100] safe-pb">
        {[
            { id: 'link', icon: Bluetooth, label: 'LINK' },
            { id: 'trace', icon: Activity, label: 'HUD' },
            { id: 'library', icon: Database, label: 'DATA' },
            { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
        ].map(tab => (
            <button 
                key={tab.id}
                onClick={() => setDashboardTab(tab.id as any)}
                className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
            >
                <tab.icon size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase tracking-widest">{tab.label}</span>
            </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
