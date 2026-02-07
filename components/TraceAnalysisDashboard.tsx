
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types.ts';
import { normalizeId, decodeSignal } from '../utils/decoder.ts';
import SignalVisualizer from './SignalVisualizer.tsx';
import AIDiagnostics from './AIDiagnostics.tsx';
import { ChevronRight, ChevronDown, Activity, BarChart3, TrendingUp, Crosshair, GripVertical, BrainCircuit, Filter } from 'lucide-react';

interface TraceAnalysisDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
}

const TraceAnalysisDashboard: React.FC<TraceAnalysisDashboardProps> = ({ frames, library }) => {
  const [selectedSignalNames, setSelectedSignalNames] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'stats' | 'ai'>('stats');
  const [showFilters, setShowFilters] = useState(false);

  const plotData = useMemo(() => {
    const signalMap = new Map<string, { msg: DBCMessage; signals: DBCSignal[] }>();
    (Object.entries(library.database) as [string, DBCMessage][]).forEach(([rawId, msg]) => {
      signalMap.set(normalizeId(rawId), { msg, signals: Object.values(msg.signals) as DBCSignal[] });
    });

    return frames.map(f => {
      const data: any = { time: f.timestamp / 1000 };
      const mapping = signalMap.get(normalizeId(f.id));
      if (mapping) {
        mapping.signals.forEach(sig => {
          const valStr = decodeSignal(f.data, sig);
          const valNum = parseFloat(valStr);
          if (!isNaN(valNum)) data[sig.name] = valNum;
        });
      }
      return data;
    });
  }, [frames, library]);

  const signalGroups = useMemo(() => 
    (Object.entries(library.database) as [string, DBCMessage][])
      .map(([id, msg]) => ({ id, name: msg.name, signals: Object.keys(msg.signals) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  , [library]);

  const stats = useMemo(() => {
    if (selectedSignalNames.length === 0 || plotData.length === 0) return null;
    const activeSignal = selectedSignalNames[0];
    const values = plotData.map(d => d[activeSignal]).filter(v => v !== undefined);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { name: activeSignal, min, max, avg: values.reduce((a, b) => a + b, 0) / values.length, count: values.length };
  }, [selectedSignalNames, plotData]);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-white overflow-hidden lg:rounded-xl">
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="text-[10px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Analysis HUD</h3>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-orbitron font-black uppercase border transition-all ${showFilters ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
              <Filter size={14} /> Signals
          </button>
      </div>

      {/* Side/Mobile Filter Panel */}
      <div className={`${showFilters ? 'fixed inset-0 z-[80] bg-white' : 'hidden'} lg:flex lg:relative lg:flex-col bg-slate-50 shrink-0 border-r border-slate-200 lg:w-72`}>
        <div className="p-4 border-b border-slate-200 bg-slate-100/50 shrink-0 flex justify-between items-center lg:block">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> SIGNAL_MATRIX
          </h3>
          <button onClick={() => setShowFilters(false)} className="lg:hidden text-[9px] font-bold text-slate-400">CLOSE</button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {signalGroups.map(group => (
            <div key={group.id} className="mb-1">
              <button onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} className="w-full flex items-center gap-2 px-3 py-3 lg:py-1.5 hover:bg-white rounded text-left transition-colors group">
                {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-[11px] lg:text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate">{group.name}</span>
              </button>
              {expandedGroups.includes(group.id) && (
                <div className="ml-6 space-y-2 lg:space-y-1 mt-1 border-l border-slate-200 pl-3">
                  {group.signals.map(sig => (
                    <button key={sig} onClick={() => setSelectedSignalNames(prev => prev.includes(sig) ? prev.filter(s => s !== sig) : [...prev, sig])} className={`w-full flex items-center gap-3 px-3 py-3 lg:py-1 rounded text-left text-[11px] lg:text-[9px] transition-all ${selectedSignalNames.includes(sig) ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
                      <div className={`w-3 h-3 lg:w-2 lg:h-2 rounded-sm border ${selectedSignalNames.includes(sig) ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'}`} />
                      {sig}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
         <div className="flex-1 overflow-hidden">
             <SignalVisualizer logData={plotData} availableSignals={selectedSignalNames} library={library} fullMode={true} />
         </div>

         {/* Stats Drawer (Bottom on Mobile, Side on Desktop) */}
         <div className="lg:w-[350px] lg:border-l lg:bg-slate-50 bg-white border-t p-4 shrink-0 max-h-[40vh] overflow-y-auto lg:max-h-none">
            <div className="flex items-center justify-between mb-4">
               <div className="flex gap-2">
                 <button onClick={() => setViewMode('stats')} className={`p-2 rounded-xl transition-colors ${viewMode === 'stats' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}><BarChart3 size={18}/></button>
                 <button onClick={() => setViewMode('ai')} className={`p-2 rounded-xl transition-colors ${viewMode === 'ai' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><BrainCircuit size={18}/></button>
               </div>
               <h3 className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest">{viewMode === 'ai' ? 'GEMINI_AI' : 'STATS'}</h3>
            </div>
            {viewMode === 'ai' ? (
                <AIDiagnostics currentFrames={frames} />
            ) : stats ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-emerald-600" />
                        <h4 className="text-[11px] font-orbitron font-black uppercase truncate">{stats.name}</h4>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center"><span className="text-[9px] text-slate-400 uppercase">Min</span><span className="text-[12px] font-bold text-emerald-600">{stats.min.toFixed(2)}</span></div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center"><span className="text-[9px] text-slate-400 uppercase">Max</span><span className="text-[12px] font-bold text-emerald-600">{stats.max.toFixed(2)}</span></div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center col-span-2 lg:col-span-1"><span className="text-[9px] text-slate-400 uppercase">Avg</span><span className="text-[12px] font-bold text-slate-900">{stats.avg.toFixed(2)}</span></div>
                    </div>
                </div>
            ) : (
                <p className="text-[9px] text-slate-300 uppercase font-black text-center py-8">Select signal to view stats</p>
            )}
         </div>
      </div>
    </div>
  );
};

export default TraceAnalysisDashboard;
