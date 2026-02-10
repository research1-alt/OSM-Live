
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Info, RefreshCcw, Settings } from 'lucide-react';
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

  const latestReason = useMemo(() => {
    if (debugLog.length === 0) return null;
    const relevantLog = debugLog.find(log => 
      log.includes('ERROR') || log.includes('REG_ERROR') || log.includes('RECOVERY') || log.includes('SCANNING')
    );
    if (!relevantLog) return null;
    const cleanLog = relevantLog.replace(/^\[.*?\]\s*/, '');
    const isError = cleanLog.includes('ERROR') || cleanLog.includes('Fail');
    const isCode2 = cleanLog.includes('Code 2');
    return { text: cleanLog, isError, isCode2 };
  }, [debugLog]);

  const handleSystemReset = () => {
    if ((window as any).NativeBleBridge?.openBluetoothSettings) {
        (window as any).NativeBleBridge.openBluetoothSettings();
    }
  };

  const handleNativeHardReset = () => {
      if ((window as any).NativeBleBridge?.startBleLink) {
          (window as any).NativeBleBridge.startBleLink();
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
              <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <button onClick={() => onSetHardwareMode('pcan')} className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                <Globe size={24}/><span className="text-[9px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              <button onClick={() => onSetHardwareMode('esp32-serial')} className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                <Cable size={24}/><span className="text-[9px] font-orbitron font-black uppercase">Wired</span>
              </button>
              <button onClick={() => onSetHardwareMode('esp32-bt')} className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                <Bluetooth size={24}/><span className="text-[9px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {latestReason?.isCode2 && (
              <div className="mb-6 p-5 bg-red-600 rounded-3xl text-white animate-in zoom-in duration-300 shadow-xl border border-red-700">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle size={24} />
                  <h4 className="text-[12px] font-orbitron font-black uppercase tracking-widest">CRITICAL: STACK SATURATION</h4>
                </div>
                <p className="text-[10px] font-medium leading-relaxed mb-4 opacity-90">
                  Android Bluetooth registration handles are full. Programmatic fix is impossible. <br/>
                  <b>Action:</b> Toggle Bluetooth OFF and ON in System Settings.
                </p>
                <button onClick={handleSystemReset} className="w-full py-3 bg-white text-red-600 rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest shadow-lg active:scale-95 flex items-center justify-center gap-2">
                   <Settings size={14} /> Open System Settings
                </button>
              </div>
            )}

            {status !== 'connected' && !latestReason?.isCode2 && latestReason && (
              <div className={`mb-8 p-4 rounded-2xl border flex items-start gap-3 ${latestReason.isError ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
                {latestReason.isError ? <AlertCircle size={18} className="text-red-500 mt-0.5" /> : <Info size={18} className="text-indigo-500 mt-0.5" />}
                <div className="flex flex-col gap-1">
                  <p className={`text-[10px] font-black uppercase ${latestReason.isError ? 'text-red-700' : 'text-indigo-700'}`}>Report_Log</p>
                  <p className={`text-[10px] font-mono leading-tight ${latestReason.isError ? 'text-red-600' : 'text-indigo-600'}`}>{latestReason.text}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 mt-6">
            <button 
              onClick={onConnect} 
              disabled={status === 'connecting'} 
              className={`w-full py-8 rounded-[24px] text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 ${status === 'connected' ? 'hidden' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
               {status === 'connecting' ? <Loader2 className="animate-spin" size={24}/> : <>ESTABLISH_LINK <Zap size={20}/></>}
            </button>

            {status === 'connected' && (
              <button onClick={onDisconnect} className="w-full py-8 rounded-[24px] bg-red-50 text-red-600 border border-red-100 text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-xl hover:bg-red-100 flex items-center justify-center gap-4">
                 DISCONNECT <RefreshCcw size={20} />
              </button>
            )}

            {hardwareMode === 'esp32-bt' && (
                <button 
                  onClick={handleNativeHardReset} 
                  className="w-full py-3 text-slate-400 font-bold uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:text-indigo-600 transition-colors"
                >
                  <RefreshCcw size={14} /> Hard_Native_Flush
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
