
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, RefreshCw, Cpu, ArrowLeft, Download, FileUp, Loader2, Database, Activity, Zap, BarChart3, Settings2, ShieldAlert, Cable, AlertTriangle, Power, Save, Bluetooth, Menu, X } from 'lucide-react';
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
  const [hardwareMode, setHardwareMode] = useState<HardwareMode>('esp32-bt');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [rxByteCount, setRxByteCount] = useState(0);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });
  
  const isPausedRef = useRef(false);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const sessionStartTimeRef = useRef<number>(performance.now());
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

  const handleSaveTrace = useCallback(async (framesToSave: CANFrame[]) => {
    if (framesToSave.length === 0) return;
    setIsSaving(true);
    addDebugLog(`SYSTEM: EXPORTING TRACE...`);
    
    try {
      const header = "; PCAN Trace File\n; Created by OSM Tactical HUD\n;-------------------------------------------------------------------------------\n";
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
      link.download = `OSM_Trace_${Date.now()}.trc`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      addDebugLog(`ERROR: SAVE FAILED - ${err.message}`);
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
      addDebugLog(`HW: ${cleanLine}`);
      return;
    }
    const parts = cleanLine.split('#');
    if (parts.length >= 3) {
      const id = parts[0].trim();
      const dlc = parseInt(parts[1].trim());
      const rawData = parts[2].trim();
      const data = rawData.split(/[, ]+/).filter(x => x.length > 0);
      if (id && !isNaN(dlc) && data.length > 0) handleNewFrame(id, dlc, data);
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
          if (combined.length >= MAX_FRAME_LIMIT) return combined.slice(-MAX_FRAME_LIMIT);
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
  }, []);

  const disconnectHardware = async () => {
    if (btDeviceRef.current) {
      if (btDeviceRef.current.gatt.connected) btDeviceRef.current.gatt.disconnect();
      btDeviceRef.current = null;
    }
    if (serialPortRef.current) { try { await serialPortRef.current.close(); } catch {} }
    setBridgeStatus('disconnected');
    setHwStatus('offline');
    addDebugLog("Link Disconnected.");
  };

  const connectESP32Serial = async () => {
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: baudRate, dtr: true, rts: true });
      serialPortRef.current = port;
      setBridgeStatus('connected');
      sessionStartTimeRef.current = performance.now();
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
        for (const line of lines) if (line.trim()) parseESP32Line(line);
      }
    } catch (err: any) { 
      addDebugLog(`Connection Error: ${err.message}`);
      setBridgeStatus('error'); 
      disconnectHardware(); 
    }
  };

  const connectESP32Bluetooth = async () => {
    try {
      setBridgeStatus('connecting');
      addDebugLog("Attempting Bluetooth Request...");
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
      device.addEventListener('gattserverdisconnected', () => {
        addDebugLog("BT Link Terminated.");
        disconnectHardware();
      });
    } catch (err: any) {
      addDebugLog(`BT Link Error: ${err.message}`);
      setBridgeStatus('error');
      disconnectHardware();
    }
  };

  const connectBridge = useCallback(() => {
    if (hardwareMode === 'esp32-serial') connectESP32Serial();
    else if (hardwareMode === 'esp32-bt') connectESP32Bluetooth();
  }, [hardwareMode, baudRate]);

  if (view === 'home') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-6xl md:text-8xl font-orbitron font-black text-slate-900 uppercase leading-none">OSM <span className="text-indigo-600">LIVE</span></h1>
        <p className="mt-4 text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-[0.5em]">Tactical Interface</p>
        <button onClick={() => setView('live')} className="mt-16 w-full max-w-xs py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">
          Initialize HUD
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50">
      <header className="h-16 md:h-20 border-b flex items-center justify-between px-4 md:px-10 bg-white/90 backdrop-blur-xl z-[70]">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => { disconnectHardware(); setView('home'); }} className="p-2.5 bg-slate-100 rounded-xl">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          
          <div className="hidden md:flex bg-slate-100 p-1 rounded-xl gap-1">
            {['link', 'trace', 'library', 'analysis'].map((tab) => (
              <button key={tab} onClick={() => setDashboardTab(tab as any)} className={`px-4 py-1.5 rounded-lg text-[9px] font-orbitron font-black uppercase tracking-widest ${dashboardTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>
          
          <div className="md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className={`px-3 py-1 rounded-lg border font-mono text-[9px] font-bold ${
            bridgeStatus === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
            bridgeStatus === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'
          }`}>
            {bridgeStatus.toUpperCase()}
          </div>
          <button onClick={() => setIsPaused(!isPaused)} className={`px-4 md:px-8 py-2 md:py-3 rounded-xl text-[9px] font-orbitron font-black uppercase ${isPaused ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border'}`}>
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-[65] animate-in slide-in-from-top duration-300 p-6">
          <div className="grid grid-cols-1 gap-4">
            {['link', 'trace', 'library', 'analysis'].map((tab) => (
              <button key={tab} onClick={() => { setDashboardTab(tab as any); setMobileMenuOpen(false); }} className={`w-full py-6 rounded-3xl text-sm font-orbitron font-black uppercase tracking-widest border transition-all ${dashboardTab === tab ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 p-3 md:p-6 overflow-hidden">
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

      <footer className="h-10 md:h-12 border-t bg-white px-4 md:px-10 flex items-center justify-between text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-2">
              <Power size={10} className={hwStatus === 'active' ? 'text-indigo-600' : 'text-slate-300'} />
              <span className="hidden md:inline">LINK: </span><span className={hwStatus === 'active' ? 'text-emerald-500' : 'text-slate-400'}>{hwStatus.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database size={10} className="text-indigo-600" />
              <span>BUF: {frames.length}</span>
            </div>
          </div>
          <div>OSM_M_V12</div>
      </footer>
    </div>
  );
};

export default App;
