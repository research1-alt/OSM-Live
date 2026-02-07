import React, { useState, useEffect } from 'react';
import { Zap, Link as LinkIcon, Cpu, Terminal, Loader2, Info, Activity, AlertCircle, Cable, Bluetooth, ShieldCheck, ShieldAlert, Smartphone, Globe, Search } from 'lucide-react';
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
  pcanAddress,
  setPcanAddress,
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

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto pt-2 pb-10 overflow-y-auto px-4">
      <div className={`p-4 rounded-3xl flex items-center gap-4 shadow-sm ${isNative ? 'bg-emerald-50 border border-emerald-100' : 'bg-indigo-50 border border-indigo-100'}`}>
           <div className="bg-white p-2 rounded-xl shadow-sm">{isNative ? <Smartphone size={20} className="text-emerald-600"/> : <AlertCircle size={20} className="text-indigo-600"/>}</div>
           <div className="flex-1">
              <h4 className="text-[11px] font-orbitron font-black uppercase tracking-widest">{isNative ? 'Native Bridge Ready' : 'Web Environment'}</h4>
              <p className="text-[10px] text-slate-600 font-medium leading-tight">
                {isNative ? 'Using Native Android GATT Bridge. Ensure GPS/Location is ON for device discovery.' : 'Direct Bluetooth is restricted in browser. Use PCAN Bridge.'}
              </p>
           </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel border border-slate-200 bg-white rounded-[40px] p-6 lg:p-10 shadow-2xl flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                <Cpu className="text-indigo-600" size={32} /> Link_Manager
              </h3>
              <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase ${status === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>{status}</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <button onClick={() => onSetHardwareMode('pcan')} className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}><Globe size={20}/><span className="text-[8px] font-orbitron font-black">PCAN</span></button>
              <button onClick={() => onSetHardwareMode('esp32-serial')} className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}><Cable size={20}/><span className="text-[8px] font-orbitron font-black">WIRED</span></button>
              <button onClick={() => onSetHardwareMode('esp32-bt')} className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-50 text-slate-400'}`}><Bluetooth size={20}/><span className="text-[8px] font-orbitron font-black">BLE</span></button>
            </div>

            {hardwareMode === 'esp32-bt' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
                 <div className="flex items-center justify-between text-[9px] font-orbitron font-black uppercase"><span className="text-slate-400">BLE Discovery Status</span><Bluetooth size={12} className="text-indigo-400"/></div>
                 <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Android Scan Permissions</span>
                        <ShieldCheck size={14} className="text-emerald-500"/>
                    </div>
                    {isScanning && (
                      <div className="flex items-center gap-3 p-3 bg-white border border-indigo-100 rounded-xl animate-pulse">
                         <Loader2 size={14} className="animate-spin text-indigo-600" />
                         <span className="text-[9px] font-orbitron font-black text-indigo-600 uppercase">Searching for OSM_CAN...</span>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {hardwareMode === 'pcan' && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
                 <label className="text-[9px] font-bold text-slate-400 uppercase">Bridge_Address</label>
                 <input type="text" value={pcanAddress} onChange={(e) => setPcanAddress?.(e.target.value)} placeholder="192.168.x.x:8080" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[11px] font-mono"/>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-6 rounded-3xl text-[11px] font-orbitron font-black uppercase tracking-[0.4em] shadow-xl transition-all flex items-center justify-center gap-3 ${status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-600 text-white'}`}
            >
               {status === 'connecting' ? <Loader2 className="animate-spin" size={18}/> : status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
               {!status.includes('connect') && <Zap size={16} />}
            </button>
            {isScanning && (
               <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Scanning for "OSM_CAN_BT" signals...</p>
            )}
          </div>
        </div>

        <div className="glass-panel border border-slate-200 bg-slate-50 rounded-[40px] p-6 lg:p-8 flex flex-col min-h-[400px] shadow-inner">
          <div className="flex items-center gap-3 mb-4"><Terminal size={18} className="text-slate-500"/><span className="text-[12px] font-orbitron font-black uppercase">Link_Console</span></div>
          <div className="flex-1 bg-slate-900 rounded-3xl p-6 font-mono text-[11px] text-emerald-500/80 overflow-y-auto flex flex-col-reverse shadow-2xl">
             {debugLog.map((log, i) => <div key={i} className="py-1 border-b border-slate-800/30 break-all">{log}</div>)}
             {debugLog.length === 0 && <div className="h-full flex items-center justify-center text-slate-700 uppercase tracking-widest opacity-40 text-center">Awaiting native bridge <br/> initialization...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
