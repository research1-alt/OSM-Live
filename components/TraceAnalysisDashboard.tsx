
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types.ts';
import { normalizeId, decodeSignal } from '../utils/decoder.ts';
import SignalVisualizer from './SignalVisualizer.tsx';
import AIDiagnostics from './AIDiagnostics.tsx';
import { ChevronRight, ChevronDown, Activity, BarChart3, TrendingUp, Crosshair, GripVertical, BrainCircuit } from 'lucide-react';

interface TraceAnalysisDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
}

const TraceAnalysisDashboard: React.FC<TraceAnalysisDashboardProps> = ({ frames, library }) => {
  const [selectedSignalNames, setSelectedSignalNames] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'stats' | 'ai'>('stats');
  
  const [leftWidth, setLeftWidth] = useState(280);
  const [navWidth, setNavWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(350);
  
  const isResizingRef = useRef<'left' | 'nav' | 'right' | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (isResizingRef.current === 'left') setLeftWidth(Math.max(200, Math.min(500, e.clientX)));
      else if (isResizingRef.current === 'nav') setNavWidth(Math.max(200, Math.min(500, e.clientX - leftWidth)));
      else if (isResizingRef.current === 'right') setRightWidth(Math.max(250, Math.min(600, window.innerWidth - e.clientX)));
    };
    const handleMouseUp = () => { isResizingRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [leftWidth]);

  const plotData = useMemo(() => {
    const signalMap = new Map<string, { msg: DBCMessage; signals: DBCSignal[] }>();
    // Fixed: Cast Object.entries to correct type to resolve unknown message type errors
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
    // Fixed: Cast Object.entries to correct type to resolve unknown message type errors
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
    <div className="flex h-full w-full bg-white overflow-hidden rounded-xl border border-slate-200 shadow-2xl">
      {/* File Structure Column */}
      <div className="flex flex-col bg-slate-50 shrink-0 border-r border-slate-200 relative" style={{ width: `${leftWidth}px` }}>
        <div className="p-4 border-b border-slate-200 bg-slate-100/50 shrink-0">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> INTERNAL_FILE_STRUCTURE
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {signalGroups.map(group => (
            <div key={group.id} className="mb-1">
              <button onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white rounded text-left transition-colors group">
                {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate">{group.name}</span>
              </button>
              {expandedGroups.includes(group.id) && (
                <div className="ml-6 space-y-1 mt-1 border-l border-slate-200 pl-2">
                  {group.signals.map(sig => (
                    <button key={sig} onClick={() => setSelectedSignalNames(prev => prev.includes(sig) ? prev.filter(s => s !== sig) : [...prev, sig])} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[9px] transition-all ${selectedSignalNames.includes(sig) ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
                      <div className={`w-2 h-2 rounded-sm border ${selectedSignalNames.includes(sig) ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'}`} />
                      {sig}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50 flex items-center justify-center group" onMouseDown={() => isResizingRef.current = 'left'}>
          <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
        </div>
      </div>

      {/* Visualizer Column */}
      <div className="flex-1 flex min-w-0 bg-white relative overflow-hidden">
         <SignalVisualizer logData={plotData} availableSignals={selectedSignalNames} library={library} fullMode={true} navigatorWidth={navWidth} onResizeNav={() => isResizingRef.current = 'nav'} />
      </div>

      {/* Analytics Column */}
      <div className="flex flex-col bg-slate-50 shrink-0 border-l border-slate-200 relative" style={{ width: `${rightWidth}px` }}>
        <div className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-emerald-500/50 transition-colors z-50 flex items-center justify-center group" onMouseDown={() => isResizingRef.current = 'right'}>
          <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
        </div>

        <div className="p-4 border-b border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setViewMode('stats')} className={`p-1.5 rounded transition-colors ${viewMode === 'stats' ? 'text-emerald-600 bg-emerald-100 shadow-sm' : 'text-slate-400 hover:text-slate-800'}`}><BarChart3 size={14}/></button>
            <button onClick={() => setViewMode('ai')} className={`p-1.5 rounded transition-colors ${viewMode === 'ai' ? 'text-indigo-600 bg-indigo-100 shadow-sm' : 'text-slate-400 hover:text-slate-800'}`}><BrainCircuit size={14}/></button>
          </div>
          <h3 className={`text-[10px] font-orbitron font-black uppercase tracking-widest ${viewMode === 'ai' ? 'text-indigo-600' : 'text-emerald-600'}`}>
            {viewMode === 'ai' ? 'GEMINI_DIAGNOSTICS' : 'TELEMETRY_ANALYTICS'}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {viewMode === 'ai' ? (
            <AIDiagnostics currentFrames={frames} />
          ) : stats ? (
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <TrendingUp size={16} className="text-emerald-600" />
                <h4 className="text-[12px] font-orbitron font-black uppercase truncate">{stats.name}</h4>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 font-mono text-[10px] shadow-sm">
                <div className="flex justify-between"><span className="text-slate-400">Min</span><span className="text-emerald-600 font-bold">{stats.min.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Max</span><span className="text-emerald-600 font-bold">{stats.max.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Average</span><span className="text-slate-900 font-bold">{stats.avg.toFixed(4)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-400">Samples</span><span className="text-slate-900">{stats.count}</span></div>
              </div>
            </section>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-24">
              <Crosshair className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-[9px] font-orbitron font-black text-slate-300 uppercase tracking-widest">Select Signal to Project Stats</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraceAnalysisDashboard;
