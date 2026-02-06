
import React, { useState, useEffect } from 'react';
import { Zap, Link as LinkIcon, Cpu, Terminal, Loader2, Info, Activity, AlertCircle, Cable, Settings2, Bluetooth, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';
import ESP32SetupGuide from './ESP32SetupGuide.tsx';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'pcan' | 'esp32-serial' | 'esp32-bt';
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
  onSetHardwareMode,
  baudRate,
  setBaudRate,
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [showSetup, setShowSetup] = useState(false);
  const [btSupported, setBtSupported] = useState<boolean>(true);
  const [isHttps, setIsHttps] = useState(true);
  const [forceEnable, setForceEnable] = useState(false);

  useEffect(() => {
    // Some mobile wrappers inject navigator.bluetooth after a small delay
    const checkSupport = () => {
        const hasBT = !!(navigator as any).bluetooth;
        setBtSupported(hasBT);
    };
    
    checkSupport();
    const timer = setTimeout(checkSupport, 2000);
    
    setIsHttps(
        window.location.protocol === 'https:' || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.protocol === 'file:' // Support for local file access in some wrappers
    );
    
    return () => clearTimeout(timer);
  }, []);

  const isBluetoothBlocked = hardwareMode === 'esp32-bt' && (!btSupported && !forceEnable);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto pt-2 animate-in fade-in pb-10 overflow-y-auto max-h-full custom-scrollbar">
      {showSetup && <ESP32SetupGuide baudRate={baudRate} onClose={() => setShowSetup(false)} />}
      
      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-3xl flex items-center gap-4 shadow-sm">
         <div className="bg-white p-2 rounded-xl text-indigo-600 shadow-sm">
            <AlertCircle size={20} />
         </div>
         <div className="flex-1">
            <h4 className="text-[11px] font-orbitron font-black text-indigo-900 uppercase tracking-widest">Hardware Interfacing</h4>
            <p className="text-[10px] text-indigo-600 font-medium leading-relaxed">Mobile App Mode Detected. Ensure you are using <span className="font-bold text-indigo-800 underline">Trusted Web Activity</span> in Android Studio for Bluetooth support.</p>
         </div>
      </div>

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
                <Activity size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Cable size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">Wired</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Bluetooth size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {hardwareMode === 'esp32-bt' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center justify-between text-[9px] font-orbitron font-black uppercase tracking-widest">
                    <span className="text-slate-400">BT Readiness Check</span>
                    <Bluetooth size={12} className="text-indigo-400" />
                 </div>
                 <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Browser/App Support</span>
                        {btSupported ? <ShieldCheck size={14} className="text-emerald-500" /> : <ShieldAlert size={14} className="text-red-500" />}
                    </div>
                 </div>
                 {!btSupported && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-[8px] text-red-600 font-bold uppercase leading-tight mb-2">
                            Bluetooth is disabled in this WebView.
                        </p>
                        <button 
                            onClick={() => setForceEnable(true)}
                            className="text-[8px] bg-red-600 text-white px-3 py-1 rounded-md font-black uppercase"
                        >
                            Force Bypass Check
                        </button>
                    </div>
                 )}
              </div>
            )}

            {hardwareMode === 'esp32-serial' && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={12} /> Baud Rate Configuration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[115200, 500000, 921600].map(rate => (
                    <button 
                      key={rate} 
                      onClick={() => setBaudRate(rate)}
                      className={`py-2.5 rounded-xl border font-mono text-[10px] font-bold transition-all ${
                        baudRate === rate ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {rate.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()}
              disabled={status === 'connecting' || isBluetoothBlocked}
              className={`w-full py-6 rounded-3xl text-[11px] font-orbitron font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status === 'connecting' ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
              {hardwareMode === 'esp32-bt' ? <Bluetooth size={18} /> : <Zap size={18} fill={status === 'connected' ? 'none' : 'currentColor'} />}
            </button>
          </div>
        </div>

        <div className="glass-panel border border-slate-200 bg-slate-50 rounded-[40px] p-6 lg:p-8 flex flex-col min-h-[400px] lg:min-h-[550px] shadow-inner">
          <div className="flex items-center justify-between mb-4 lg:mb-6 px-2">
            <div className="flex items-center gap-3">
              <Terminal size={18} className="text-slate-500" />
              <span className="text-[12px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Link_Console</span>
            </div>
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
