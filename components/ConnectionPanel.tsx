
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, ShieldCheck, Wifi, WifiOff, Search, Monitor, Smartphone } from 'lucide-react';
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
  const [isNative, setIsNative] = useState(false);
  const isDesktop = useMemo(() => !isNative && /Windows|Macintosh|Linux/.test(navigator.userAgent), [isNative]);

  useEffect(() => {
    setIsNative(!!(window as any).NativeBleBridge);
  }, []);

  const hasGattError = useMemo(() => debugLog.some(log => log.includes('GATT') || log.includes('BLE_FAULT')), [debugLog]);

  const getStatusDetail = () => {
    if (status === 'connected') return {
      title: "LINK_ESTABLISHED",
      desc: "Tactical bridge active. Telemetry stream is live and secured.",
      icon: <Wifi className="text-emerald-500" size={24} />,
      color: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
    if (status === 'connecting') return {
      title: "HANDSHAKING...",
      desc: "Negotiating GATT protocol with hardware. Ensure distance < 2 meters.",
      icon: <Loader2 className="text-indigo-500 animate-spin" size={24} />,
      color: "bg-indigo-50 border-indigo-100 text-indigo-700"
    };
    if (hasGattError && isDesktop) return {
      title: "DESKTOP_GATT_LOCK",
      desc: "Device is locked by Windows/macOS. Go to System Bluetooth Settings and 'Remove' or 'Unpair' the device first.",
      icon: <Monitor className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    if (status === 'error') return {
      title: "BRIDGE_ERROR",
      desc: "Protocol fault in the hardware bridge. Reset ESP32 power and try again.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    
    return {
      title: "READY_FOR_LINK",
      desc: "Link status is offline. Select mode and establish connection to begin.",
      icon: <WifiOff className="text-slate-300" size={24} />,
      color: "bg-slate-50 border-slate-100 text-slate-500"
    };
  };

  const currentStatus = getStatusDetail();

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
              <div className="flex items-center gap-2">
                 {isDesktop ? <Monitor size={14} className="text-slate-300" /> : <Smartphone size={14} className="text-slate-300" />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                disabled={true}
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all opacity-30 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-400`}
              >
                <Cable size={24}/><span className="text-[9px] font-orbitron font-black uppercase">Wired (Soon)</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={24}/><span className="text-[9px] font-orbitron font-black uppercase">Bluetooth</span>
              </button>
            </div>

            <div className={`mb-8 p-6 rounded-[32px] border transition-all duration-500 shadow-inner ${currentStatus.color}`}>
               <div className="flex items-center gap-4 mb-3">
                  <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                    {currentStatus.icon}
                  </div>
                  <div>
                    <h4 className="text-[12px] font-orbitron font-black uppercase tracking-widest">{currentStatus.title}</h4>
                  </div>
               </div>
               <p className="text-[11px] font-medium leading-relaxed">
                  {currentStatus.desc}
               </p>
               
               {isDesktop && status === 'disconnected' && (
                 <div className="mt-4 pt-4 border-t border-slate-200/50">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Info size={10} /> Desktop Connectivity Tip
                    </p>
                    <p className="text-[10px] text-slate-500 italic">
                      If the device shows in the list but fails to connect, ensure it is <b>not</b> paired in your OS Bluetooth settings.
                    </p>
                 </div>
               )}
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
