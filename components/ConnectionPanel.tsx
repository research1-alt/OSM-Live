
import React, { useState, useEffect } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe } from 'lucide-react';
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
  const isScanning = status === 'connecting' && hardwareMode === 'esp32-bt';
  const hasError = debugLog.some(log => log.includes('ERROR') || log.includes('STATE_ERROR'));

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto px-4 py-4 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-sm">
        <div className="glass-panel bg-white rounded-[32px] p-6 shadow-xl flex flex-col min-h-0">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                <h3 className="text-xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-3">
                  <Cpu className="text-indigo-600" size={24} /> Link_Manager
                </h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Hardware Bridge</p>
              </div>
              <div className={`px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <button 
                onClick={() => onSetHardwareMode('pcan')} 
                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Globe size={18}/>
                <span className="text-[7px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={18}/>
                <span className="text-[7px] font-orbitron font-black uppercase">Wired</span>
              </button>
              
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-2 p-3 rounded-[20px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={18}/>
                <span className="text-[7px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-auto">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-5 rounded-[20px] text-[11px] font-orbitron font-black uppercase tracking-[0.2em] shadow-lg transition-all flex items-center justify-center gap-3 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100' : 
                hasError ? 'bg-amber-600 text-white hover:bg-amber-700' : 
                'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
               {status === 'connecting' ? (
                 <Loader2 className="animate-spin" size={20}/>
               ) : (
                 <>
                   {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
                   <Zap size={16} className={status === 'connected' ? 'text-red-600' : 'text-white'} />
                 </>
               )}
            </button>
            
            {isScanning && (
               <div className="flex flex-col items-center gap-1.5 animate-pulse">
                  <p className="text-[8px] text-indigo-600 font-black uppercase tracking-widest italic">Synchronizing...</p>
                  <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-1/2 animate-[shimmer_2s_infinite]"></div>
                  </div>
               </div>
            )}
            
            {status === 'connected' && (
              <p className="text-[8px] text-center text-emerald-500 font-black uppercase tracking-widest animate-pulse mt-1">
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
