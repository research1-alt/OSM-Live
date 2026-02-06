
import React, { useState } from 'react';
import { Zap, Link as LinkIcon, Cpu, Terminal, Loader2, Info, Activity, Cable, Settings2, Bluetooth, ChevronRight } from 'lucide-react';
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
  hardwareMode,
  onSetHardwareMode,
  baudRate,
  setBaudRate,
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pt-4 animate-in fade-in pb-10 overflow-y-auto max-h-full custom-scrollbar">
      {showSetup && <ESP32SetupGuide baudRate={baudRate} onClose={() => setShowSetup(false)} />}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Link Controller */}
        <div className="glass-panel border border-slate-200 bg-white rounded-[40px] p-8 lg:p-12 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[550px]">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <LinkIcon size={120} />
          </div>

          <div className="flex items-center justify-between mb-10">
            <h3 className="text-2xl lg:text-3xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
              <Cpu className="text-indigo-600" size={32} /> Link_Manager
            </h3>
            <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
              status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {status}
            </div>
          </div>

          <div className="flex flex-col gap-8 mb-8">
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => onSetHardwareMode('pcan')}
                className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all ${
                  hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Activity size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase tracking-widest">PCAN</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')}
                className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Cable size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase tracking-widest">Wired</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')}
                className={`flex flex-col items-center gap-4 p-6 rounded-3xl border transition-all ${
                  hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <Bluetooth size={20} />
                <span className="text-[8px] font-orbitron font-black uppercase tracking-widest">BLE</span>
              </button>
            </div>

            {hardwareMode === 'esp32-serial' && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={12} /> Baud Rate Configuration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[115200, 500000, 921600].map(rate => (
                    <button 
                      key={rate} 
                      onClick={() => setBaudRate(rate)}
                      className={`py-3 rounded-xl border font-mono text-[10px] font-bold transition-all ${
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
              disabled={status === 'connecting'}
              className={`w-full py-7 rounded-3xl text-[12px] font-orbitron font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'
              } disabled:opacity-50`}
            >
              {status === 'connecting' ? <Loader2 className="animate-spin" size={18} /> : null}
              {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
              {hardwareMode === 'esp32-bt' ? <Bluetooth size={18} /> : <Zap size={18} fill={status === 'connected' ? 'none' : 'currentColor'} />}
            </button>

            <button 
              onClick={() => setShowSetup(true)}
              className="w-full text-center text-[9px] font-orbitron font-black text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              Bridge Setup Documentation <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Console Panel */}
        <div className="glass-panel border border-slate-200 bg-slate-50 rounded-[40px] p-6 lg:p-10 flex flex-col min-h-[400px] lg:min-h-[550px] shadow-inner">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-3">
              <Terminal size={18} className="text-slate-500" />
              <span className="text-[12px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Link_Console</span>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-3xl p-6 font-mono text-[11px] text-emerald-500/80 overflow-y-auto custom-scrollbar flex flex-col-reverse shadow-2xl border border-slate-800">
             {debugLog.map((log, i) => (
               <div key={i} className={`py-1.5 border-b border-slate-800/30 break-all flex gap-3 ${log.includes('ERROR') ? 'text-red-400' : ''}`}>
                  <span className="text-slate-700 select-none shrink-0 font-bold">[{debugLog.length - i}]</span>
                  <span>{log}</span>
               </div>
             ))}
             {debugLog.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center text-slate-700 uppercase tracking-widest opacity-40 gap-4">
                  <Info size={32} />
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
