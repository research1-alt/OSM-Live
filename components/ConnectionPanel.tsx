
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, Terminal } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

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
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(!!(window as any).NativeBleBridge);
  }, []);

  const isCode2Error = useMemo(() => {
    return debugLog.some(log => log.includes('Code 2') || log.includes('Saturated'));
  }, [debugLog]);

  const handleOpenSettings = () => {
    if ((window as any).NativeBleBridge?.openBluetoothSettings) {
        (window as any).NativeBleBridge.openBluetoothSettings();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto py-10 px-4 overflow-y-auto">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-[40px] p-8 lg:p-12 shadow-2xl border border-slate-200 flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                  <Cpu className="text-indigo-600" size={32} /> Link_Manager
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unified Hardware Bridge</p>
              </div>
              <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === 'error' || isCode2Error ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {isCode2Error ? 'FAULT_CODE_2' : status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => onSetHardwareMode('pcan')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Globe size={24}/><span className="text-[9px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={24}/><span className="text-[9px] font-orbitron font-black uppercase">Wired</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={24}/><span className="text-[9px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {isCode2Error && (
              <div className="mb-6 p-6 bg-red-600 rounded-3xl text-white animate-in zoom-in duration-300 shadow-xl">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle size={24} />
                  <h4 className="text-[12px] font-orbitron font-black uppercase tracking-widest">SYSTEM STACK FULL</h4>
                </div>
                <p className="text-[10px] font-medium leading-relaxed mb-4 opacity-90">
                  Android's Bluetooth stack has reached its limit. <br/>
                  <b>Fix:</b> Toggle Bluetooth OFF and ON in your system settings.
                </p>
                <button onClick={handleOpenSettings} className="w-full py-3 bg-white text-red-600 rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                  <Settings size={14} /> Open System Settings
                </button>
              </div>
            )}

            <div className="mb-8 p-6 bg-slate-900 rounded-[32px] border border-slate-800 shadow-inner">
               <div className="flex items-center gap-2 mb-4 text-slate-500">
                  <Terminal size={12} />
                  <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">Bridge_Console</span>
               </div>
               <div className="h-24 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                  {debugLog.length === 0 ? (
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest italic mt-2">Awaiting system status...</p>
                  ) : (
                    debugLog.slice(0, 10).map((log, i) => (
                      <div key={i} className="flex gap-3 text-[10px] font-mono">
                         <span className="text-slate-600 shrink-0">[{debugLog.length - i}]</span>
                         <span className={log.includes('ERROR') || log.includes('FAIL') ? 'text-red-400' : log.includes('MATCH') || log.includes('ACTIVE') ? 'text-emerald-400' : 'text-slate-300'}>
                           {log.replace(/^\[.*?\]\s*/, '')}
                         </span>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-8 rounded-[24px] text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 
                'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
               {status === 'connecting' ? <Loader2 className="animate-spin" size={24}/> : (
                 <>
                   {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
                   <Zap size={20} />
                 </>
               )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
