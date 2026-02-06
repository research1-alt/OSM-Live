
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

  useEffect(() => {
    setBtSupported(!!(navigator as any).bluetooth);
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto animate-in fade-in pb-10 overflow-y-auto max-h-full custom-scrollbar">
      {showSetup && <ESP32SetupGuide baudRate={baudRate} onClose={() => setShowSetup(false)} />}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="glass-panel border border-slate-200 bg-white rounded-[48px] p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[600px]">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
             <LinkIcon size={200} />
          </div>

          <div className="flex items-center justify-between mb-12">
            <h3 className="text-4xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-6">
              <Cpu className="text-indigo-600" size={40} /> Link_Manager
            </h3>
            <div className={`px-6 py-2 rounded-full border text-[11px] font-black uppercase tracking-[0.2em] ${
              status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {status}
            </div>
          </div>

          <div className="flex flex-col gap-10 mb-10">
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => onSetHardwareMode('pcan')}
                className={`flex flex-col items-center gap-4 p-8 rounded-[32px] border transition-all ${
                  hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Activity size={24} />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">PCAN_API</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')}
                className={`flex flex-col items-center gap-4 p-8 rounded-[32px] border transition-all ${
                  hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Cable size={24} />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">WIRED_LINK</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')}
                className={`flex flex-col items-center gap-4 p-8 rounded-[32px] border transition-all ${
                  hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Bluetooth size={24} />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">BLE_LINK</span>
              </button>
            </div>

            {hardwareMode === 'esp32-bt' && !btSupported && (
              <div className="p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4">
                <ShieldAlert className="text-red-500 shrink-0" size={20} />
                <p className="text-[11px] text-red-700 font-bold uppercase tracking-tight leading-tight">
                  Web Bluetooth is restricted. Ensure you are using a compatible browser over HTTPS.
                </p>
              </div>
            )}

            {hardwareMode === 'esp32-serial' && (
              <div className="flex flex-col gap-4 p-2">
                <label className="text-[11px] font-orbitron font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                  <Settings2 size={16} className="text-indigo-400" /> Baud Rate Protocol
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[115200, 500000, 921600].map(rate => (
                    <button 
                      key={rate} 
                      onClick={() => setBaudRate(rate)}
                      className={`py-4 rounded-2xl border font-mono text-[11px] font-bold transition-all ${
                        baudRate === rate ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {rate.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-8">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()}
              disabled={status === 'connecting' || (hardwareMode === 'esp32-bt' && !btSupported)}
              className={`w-full py-8 rounded-[32px] text-[13px] font-orbitron font-black uppercase tracking-[0.5em] transition-all flex items-center justify-center gap-6 shadow-2xl active:scale-[0.98] ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 shadow-red-200' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'
              } disabled:opacity-40`}
            >
              {status === 'connecting' ? <Loader2 className="animate-spin" size={24} /> : null}
              {status === 'connected' ? 'TERMINATE_CONNECTION' : 'INITIALIZE_LINK'}
              {hardwareMode === 'esp32-bt' ? <Bluetooth size={24} /> : <Zap size={24} fill={status === 'connected' ? 'none' : 'currentColor'} />}
            </button>
            <button onClick={() => setShowSetup(true)} className="w-full text-center text-[10px] font-orbitron font-black text-slate-300 uppercase tracking-widest hover:text-indigo-500 transition-colors">
              Access Setup Documentation & Firmware
            </button>
          </div>
        </div>

        <div className="glass-panel border border-slate-200 bg-slate-50 rounded-[48px] p-10 flex flex-col min-h-[600px] shadow-inner">
          <div className="flex items-center justify-between mb-8 px-4">
            <div className="flex items-center gap-4 text-slate-500">
              <Terminal size={22} />
              <span className="text-[14px] font-orbitron font-black uppercase tracking-[0.2em]">Live_Console_Log</span>
            </div>
            <button onClick={() => {}} className="text-[9px] font-orbitron font-black text-slate-400 hover:text-red-500 uppercase tracking-widest">
              Clear_Console
            </button>
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-[32px] p-8 font-mono text-[12px] text-emerald-500/90 overflow-y-auto custom-scrollbar flex flex-col-reverse shadow-2xl border border-slate-800">
             {debugLog.map((log, i) => (
               <div key={i} className={`py-2 border-b border-slate-800/20 break-all flex gap-4 ${log.includes('ERROR') ? 'text-red-400' : ''}`}>
                  <span className="text-slate-700 select-none shrink-0 font-bold">[{debugLog.length - i}]</span>
                  <span className="leading-relaxed">{log}</span>
               </div>
             ))}
             {debugLog.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-slate-700 uppercase tracking-widest opacity-30 gap-6">
                  <Info size={48} strokeWidth={1} />
                  Awaiting link initiation...
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
