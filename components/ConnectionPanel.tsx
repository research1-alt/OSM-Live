
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, ShieldCheck, Wifi, WifiOff, Search } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'esp32-serial' | 'esp32-bt';
  onSetHardwareMode: (mode: 'esp32-serial' | 'esp32-bt') => void;
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
  const isStackFull = useMemo(() => debugLog.some(log => log.includes('Code 2')), [debugLog]);
  const isTimeout = useMemo(() => debugLog.some(log => log.includes('TIMEOUT')), [debugLog]);

  const getStatusDetail = () => {
    if (status === 'connected') return {
      title: "LINK_ESTABLISHED",
      desc: "Hardware link active. Real-time telemetry is flowing.",
      icon: <Wifi className="text-emerald-500" size={24} />,
      color: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
    if (status === 'connecting') return {
      title: "HANDSHAKING...",
      desc: "Negotiating protocol with gateway. Keep hardware nearby.",
      icon: <Loader2 className="text-indigo-500 animate-spin" size={24} />,
      color: "bg-indigo-50 border-indigo-100 text-indigo-700"
    };
    if (isStackFull) return {
      title: "STACK_FAULT",
      desc: "Bluetooth system error detected. Try toggling Bluetooth OFF/ON.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    
    return {
      title: "OFFLINE",
      desc: "Select a mode and establish link to begin capture.",
      icon: <WifiOff className="text-slate-300" size={24} />,
      color: "bg-slate-50 border-slate-100 text-slate-500"
    };
  };

  const currentStatus = getStatusDetail();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:py-10 bg-slate-50 no-scrollbar">
      <div className="w-full max-w-xl mx-auto space-y-6">
        <div className="bg-white rounded-[32px] p-6 md:p-10 shadow-xl border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <h3 className="text-xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-3">
                <Cpu className="text-indigo-600" size={24} /> Link_Manager
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unified Hardware Bridge</p>
            </div>
            <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              {status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={() => onSetHardwareMode('esp32-serial')} 
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
              <Cable size={24}/><span className="text-[10px] font-orbitron font-black uppercase">Wired_Link</span>
            </button>
            <button 
              onClick={() => onSetHardwareMode('esp32-bt')} 
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
              <Bluetooth size={24}/><span className="text-[10px] font-orbitron font-black uppercase">BLE_Wireless</span>
            </button>
          </div>

          <div className={`mb-8 p-5 rounded-2xl border ${currentStatus.color}`}>
             <div className="flex items-center gap-3 mb-2">
                {currentStatus.icon}
                <h4 className="text-[10px] font-orbitron font-black uppercase">{currentStatus.title}</h4>
             </div>
             <p className="text-[10px] font-medium leading-relaxed opacity-80">{currentStatus.desc}</p>
          </div>

          <button 
            onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
            disabled={status === 'connecting'} 
            className={`w-full py-6 rounded-2xl text-[11px] font-orbitron font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all ${
              status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-600 text-white'
            }`}
          >
             {status === 'connecting' ? <Loader2 className="animate-spin" size={20}/> : (
               <>
                 {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
                 <Zap size={16} />
               </>
             )}
          </button>
        </div>

        <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm overflow-hidden">
          <h4 className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-4">Bridge_Console_Feed</h4>
          <div className="space-y-2 h-40 overflow-y-auto custom-scrollbar font-mono text-[9px]">
            {debugLog.length === 0 ? (
              <p className="text-slate-300 italic">No activity logs recorded...</p>
            ) : (
              debugLog.map((log, i) => (
                <div key={i} className="text-slate-500 border-b border-slate-50 pb-1">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
