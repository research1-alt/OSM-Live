
import React, { useState, useEffect } from 'react';
import { Zap, Link as LinkIcon, Cpu, Terminal, Loader2, Info, Activity, AlertCircle, Cable, Settings2, Bluetooth, ShieldCheck, ShieldAlert, Smartphone, Globe } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';
import ESP32SetupGuide from './ESP32SetupGuide.tsx';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'pcan' | 'esp32-serial' | 'esp32-bt';
  pcanAddress?: string;
  setPcanAddress?: (addr: string) => void;
  onSetHardwareMode: (mode: 'pcan' | 'esp32-serial' | 'esp32-bt') => void;
  baudRate: number;
  setBaudRate: (rate: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  debugLog?: string[];
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ 
  status, 
  hwStatus = 'offline', 
  hardwareMode,
  pcanAddress,
  setPcanAddress,
  onSetHardwareMode,
  baudRate,
  setBaudRate,
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [showSetup, setShowSetup] = useState(false);
  const [btSupported, setBtSupported] = useState<boolean | null>(null);
  const [isHttps, setIsHttps] = useState(true);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Check if running inside the Android Native App via JavascriptInterface
    const isNativeApp = (window as any).AndroidInterface?.isNativeApp?.() || false;
    setIsNative(isNativeApp);
    
    // Web Bluetooth check
    setBtSupported(!!(navigator as any).bluetooth);
    
    // Protocol check
    const protocolValid = window.location.protocol === 'https:' || 
                         window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         isNativeApp; 
    setIsHttps(protocolValid);

    // Default to PCAN if native since others are restricted
    if (isNativeApp && hardwareMode !== 'pcan') {
      onSetHardwareMode('pcan');
    }
  }, [isNative, onSetHardwareMode]);

  const isBluetoothBlocked = hardwareMode === 'esp32-bt' && !isNative && (!btSupported || !isHttps);
  const showPcanSupport = hardwareMode === 'pcan';

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto pt-2 animate-in fade-in pb-10 overflow-y-auto max-h-full custom-scrollbar px-4">
      {showSetup && <ESP32SetupGuide baudRate={baudRate} onClose={() => setShowSetup(false)} />}
      
      {isNative ? (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-3xl flex items-center gap-4 shadow-sm animate-in slide-in-from-top-4">
           <div className="bg-white p-2 rounded-xl text-emerald-600 shadow-sm">
              <Smartphone size={20} />
           </div>
           <div className="flex-1">
              <h4 className="text-[11px] font-orbitron font-black text-emerald-900 uppercase tracking-widest">Mobile Native Link Active</h4>
              <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                App environment detected. Use <span className="font-bold">PCAN WebSocket</span> for wireless link via local gateway.
              </p>
           </div>
        </div>
      ) : (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-3xl flex items-center gap-4 shadow-sm">
           <div className="bg-white p-2 rounded-xl text-indigo-600 shadow-sm">
              <AlertCircle size={20} />
           </div>
           <div className="flex-1">
              <h4 className="text-[11px] font-orbitron font-black text-indigo-900 uppercase tracking-widest">Hardware Interfacing</h4>
              <p className="text-[10px] text-indigo-600 font-medium leading-relaxed">Choose between high-speed <span className="font-bold">PCAN WebSocket</span>, wired <span className="font-bold">ESP32 Serial</span>, or wireless <span className="font-bold">ESP32 Bluetooth</span>.</p>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel border border-slate-200 bg-white rounded-[40px] p-6 lg:p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[550px]">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <LinkIcon size={120} />
          </div>

          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl lg:text-3xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
              <Cpu className="text-indigo-600" size={32} /> Link_Manager
            </h3>
            <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
              status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {status}
            </div>
          </div>

          <div className="flex flex-col gap-6 mb-8">
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => onSetHardwareMode('pcan')}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                  hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Globe size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')}
                disabled={isNative}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                } ${isNative ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <Cable size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">Wired</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')}
                disabled={isNative}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                } ${isNative ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <Bluetooth size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {hardwareMode === 'pcan' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center justify-between text-[9px] font-orbitron font-black uppercase tracking-widest">
                    <span className="text-slate-400">PCAN Bridge Settings</span>
                    <Globe size={12} className="text-indigo-400" />
                 </div>
                 <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-slate-400">BRIDGE_ADDRESS</label>
                      <input 
                        type="text" 
                        value={pcanAddress}
                        onChange={(e) => setPcanAddress?.(e.target.value)}
                        placeholder="192.168.x.x:8080"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[11px] font-mono text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Network Readiness</span>
                        <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                 </div>
              </div>
            )}

            {hardwareMode === 'esp32-bt' && !isNative && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center justify-between text-[9px] font-orbitron font-black uppercase tracking-widest">
                    <span className="text-slate-400">BT Readiness Check</span>
                    <Bluetooth size={12} className="text-indigo-400" />
                 </div>
                 <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Browser Support</span>
                        {btSupported ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldAlert size={14} className="text-red-500" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Security (HTTPS)</span>
                        {isHttps ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldAlert size={14} className="text-red-500" />}
                    </div>
                 </div>
              </div>
            )}

            {isNative && (hardwareMode === 'esp32-bt' || hardwareMode === 'esp32-serial') && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl animate-pulse">
                <p className="text-[9px] text-red-600 font-bold uppercase text-center">
                  * Hardware Link restricted in Mobile WebView. <br/> Switch to PCAN WebSocket mode.
                </p>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()}
              disabled={status === 'connecting' || isBluetoothBlocked || (isNative && hardwareMode !== 'pcan')}
              className={`w-full py-6 rounded-3xl text-[11px] font-orbitron font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status === 'connecting' ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
              {hardwareMode === 'esp32-bt' ? <Bluetooth size={18} /> : hardwareMode === 'pcan' ? <Globe size={18} /> : <Zap size={18} />}
            </button>
          </div>
        </div>

        <div className="glass-panel border border-slate-200 bg-slate-50 rounded-[40px] p-6 lg:p-8 flex flex-col min-h-[400px] lg:min-h-[550px] shadow-inner">
          <div className="flex items-center justify-between mb-4 lg:mb-6 px-2">
            <div className="flex items-center gap-3">
              <Terminal size={18} className="text-slate-500" />
              <span className="text-[12px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Link_Console</span>
            </div>
            {status === 'connected' && (
              <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">
                <Activity size={10} /> STREAM_ACTIVE
              </div>
            )}
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-3xl p-6 font-mono text-[11px] text-emerald-500/80 overflow-y-auto custom-scrollbar flex flex-col-reverse shadow-2xl border border-slate-800">
             {debugLog.map((log, i) => (
               <div key={i} className={`py-1.5 border-b border-slate-800/30 break-all flex gap-3 ${log.includes('ERROR') ? 'text-red-400' : ''}`}>
                  <span className="text-slate-700 select-none shrink-0">[{debugLog.length - i}]</span>
                  <span>{log}</span>
               </div>
             ))}
             {debugLog.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-slate-700 uppercase tracking-widest opacity-40">
                  <Info size={32} className="mb-4" />
                  Awaiting link initiation
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
