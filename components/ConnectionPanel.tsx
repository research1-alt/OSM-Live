
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Info } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

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
  hardwareMode,
  onSetHardwareMode,
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const isNativeApp = !!(window as any).AndroidInterface || !!(window as any).NativeBleBridge;
    setIsNative(isNativeApp);
  }, []);

  const isScanning = status === 'connecting' && hardwareMode === 'esp32-bt';
  
  // Extract the latest relevant status or error message from logs
  const latestReason = useMemo(() => {
    if (debugLog.length === 0) return null;
    
    // Look for the most recent error or state change
    const relevantLog = debugLog.find(log => 
      log.includes('ERROR') || 
      log.includes('STATE') || 
      log.includes('INIT') || 
      log.includes('LINK') ||
      log.includes('GATT')
    );

    if (!relevantLog) return null;

    // Strip timestamp [HH:MM:SS] if present
    const cleanLog = relevantLog.replace(/^\[.*?\]\s*/, '');
    const isError = cleanLog.includes('ERROR') || cleanLog.includes('denied') || cleanLog.includes('OFF');
    
    return {
      text: cleanLog,
      isError
    };
  }, [debugLog]);

  const hasError = latestReason?.isError;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto py-10 px-4 overflow-y-auto">
      <div className="w-full max-w-xl">
        <div className="glass-panel border border-slate-200 bg-white rounded-[40px] p-8 lg:p-12 shadow-2xl flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                  <Cpu className="text-indigo-600" size={32} /> Link_Manager
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unified Hardware Bridge</p>
              </div>
              <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === 'error' || hasError ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => onSetHardwareMode('pcan')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Globe size={24}/>
                <span className="text-[9px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={24}/>
                <span className="text-[9px] font-orbitron font-black uppercase">Wired</span>
              </button>
              
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={24}/>
                <span className="text-[9px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {/* Hardware Status / Error Reason Display */}
            {status !== 'connected' && latestReason && (
              <div className={`mb-10 p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${latestReason.isError ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                {latestReason.isError ? (
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <Info size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-1">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${latestReason.isError ? 'text-red-700' : 'text-indigo-700'}`}>
                    {latestReason.isError ? 'Connection_Failure' : 'Hardware_Report'}
                  </p>
                  <p className={`text-[11px] font-mono leading-relaxed ${latestReason.isError ? 'text-red-600' : 'text-indigo-600'}`}>
                    {latestReason.text}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-8 rounded-[24px] text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 
                hasError ? 'bg-amber-600 text-white hover:bg-amber-700' : 
                'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
               {status === 'connecting' ? (
                 <Loader2 className="animate-spin" size={24}/>
               ) : (
                 <>
                   {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
                   <Zap size={20} className={status === 'connected' ? 'text-red-600' : 'text-white'} />
                 </>
               )}
            </button>
            
            {isScanning && (
               <div className="flex flex-col items-center gap-2 animate-pulse">
                  <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest italic">Synchronizing radio frequencies...</p>
                  <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-1/2 animate-[shimmer_2s_infinite]"></div>
                  </div>
               </div>
            )}
            
            {status === 'connected' && (
              <p className="text-[9px] text-center text-emerald-500 font-black uppercase tracking-widest animate-pulse">
                Data Stream Active
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
