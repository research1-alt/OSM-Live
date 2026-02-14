
import React, { useState, useMemo, useEffect } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types.ts';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea
} from 'recharts';
import { Activity, Search, Unlock, Lock, RefreshCw, ZoomIn, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';

interface LiveVisualizerDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  selectedSignalNames: string[];
  setSelectedSignalNames: React.Dispatch<React.SetStateAction<string[]>>;
}

const LIVE_TIMEOUT_MS = 5000;

const LiveVisualizerDashboard: React.FC<LiveVisualizerDashboardProps> = ({ 
  frames, 
  library, 
  latestFrames,
  selectedSignalNames,
  setSelectedSignalNames
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [liveSync, setLiveSync] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [left, setLeft] = useState<number | string>('dataMin');
  const [right, setRight] = useState<number | string>('dataMax');

  const colors = [
    '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#a855f7', '#14b8a6',
  ];

  const activeSignals = useMemo(() => {
    const list: Array<{ id: string; cleanName: string; signals: DBCSignal[] }> = [];
    const searchLower = searchTerm.toLowerCase();
    const now = performance.now();

    // Added explicit type casting for Object.entries(latestFrames) to resolve unknown property errors
    (Object.entries(latestFrames) as [string, CANFrame][]).forEach(([normId, frame]) => {
      if (now - frame.timestamp > LIVE_TIMEOUT_MS) return;

      // Added explicit type casting for Object.entries(library.database) to resolve unknown property errors
      const dbe = (Object.entries(library.database) as [string, DBCMessage][]).find(([decId]) => normalizeId(decId) === normId);
      if (dbe) {
        const [id, message] = dbe;
        const cleanName = cleanMessageName(message.name);
        
        const matchesMsg = cleanName.toLowerCase().includes(searchLower);
        const matchedSignals = (Object.values(message.signals) as DBCSignal[]).filter(sig => 
          matchesMsg || sig.name.toLowerCase().includes(searchLower)
        );

        if (matchedSignals.length > 0) {
          list.push({ id, cleanName, signals: matchedSignals });
        }
      }
    });

    return list.sort((a, b) => a.cleanName.localeCompare(b.cleanName));
  }, [latestFrames, library, searchTerm]);

  const busLatestTime = useMemo(() => {
    if (frames.length === 0) return 0;
    return frames[frames.length - 1].timestamp / 1000;
  }, [frames]);

  useEffect(() => {
    if (liveSync && busLatestTime > 0) {
      const windowSize = 15;
      setLeft(Math.max(0, busLatestTime - windowSize));
      setRight(busLatestTime);
    }
  }, [busLatestTime, liveSync]);

  const plotData = useMemo(() => {
    if (selectedSignalNames.length === 0) return [];
    
    const sigLookup = new Map<string, { normId: string; sig: DBCSignal }>();
    const targetIds = new Set<string>();
    const windowStart = typeof left === 'number' ? left : 0;

    // Added explicit type casting for Object.values(library.database) and its entries
    (Object.values(library.database) as DBCMessage[]).forEach(msg => {
      const dbe = (Object.entries(library.database) as [string, DBCMessage][]).find(([_, v]) => v === msg);
      const normId = dbe ? normalizeId(dbe[0]) : "";
      (Object.values(msg.signals) as DBCSignal[]).forEach(s => {
        if (selectedSignalNames.includes(s.name)) {
          sigLookup.set(s.name, { normId, sig: s });
          targetIds.add(normId);
        }
      });
    });

    const relevantBuffer = frames.filter(f => {
      const fTime = f.timestamp / 1000;
      const fNormId = normalizeId(f.id.replace('0x', ''), true);
      return targetIds.has(fNormId) && fTime > (windowStart - 60);
    });

    const lkvMap: Record<string, number> = {};
    const processedPoints: any[] = [];

    selectedSignalNames.forEach(sName => {
      lkvMap[sName] = undefined as any;
    });

    relevantBuffer.forEach(f => {
      const fTime = f.timestamp / 1000;
      const fNormId = normalizeId(f.id.replace('0x', ''), true);
      
      let signalUpdated = false;
      selectedSignalNames.forEach(sName => {
        const mapping = sigLookup.get(sName);
        if (mapping && mapping.normId === fNormId) {
          const val = parseFloat(decodeSignal(f.data, mapping.sig));
          if (!isNaN(val)) {
            lkvMap[sName] = val;
            signalUpdated = true;
          }
        }
      });

      if (fTime >= windowStart && signalUpdated) {
        const data: any = { time: fTime, ...lkvMap };
        processedPoints.push(data);
      }
    });

    if (processedPoints.length === 0 && Object.values(lkvMap).some(v => v !== undefined)) {
      processedPoints.push({ time: windowStart, ...lkvMap });
    }

    return processedPoints;
  }, [frames, selectedSignalNames, library, left]);

  const toggleSignal = (sName: string) => {
    setSelectedSignalNames(prev => 
      prev.includes(sName) ? prev.filter(n => n !== sName) : [...prev, sName]
    );
  };

  const handleZoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    setLiveSync(false);
    let l = refAreaLeft;
    let r = refAreaRight;
    if (l > r) [l, r] = [r, l];
    setLeft(l);
    setRight(r);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 pb-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 tracking-[0.3em] uppercase flex items-center gap-2">
            <Activity size={14} /> SIGNAL_MATRIX
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="FILTER_BUS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-[10px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500/50 uppercase tracking-widest shadow-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {activeSignals.length === 0 ? (
          <div className="text-center py-20 opacity-30 italic text-[9px] font-bold uppercase tracking-widest px-8">
            Awaiting live bus signals...
          </div>
        ) : (
          activeSignals.map((group) => (
            <div key={group.id} className="mb-1">
              <button 
                onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} 
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white rounded text-left transition-colors group"
              >
                {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate">{group.cleanName}</span>
              </button>
              {expandedGroups.includes(group.id) && (
                <div className="ml-6 space-y-1 mt-1 border-l border-slate-200 pl-3">
                  {group.signals.map((sig) => {
                    const isSelected = selectedSignalNames.includes(sig.name);
                    return (
                      <button 
                        key={sig.name} 
                        onClick={() => toggleSignal(sig.name)} 
                        className={`w-full flex items-center gap-2 px-3 py-1 rounded text-left text-[9px] transition-all ${isSelected ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
                      >
                        <div className={`w-2 h-2 rounded-sm border ${isSelected ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'}`} />
                        {sig.name.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      {/* Sidebar Drawer for mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[160] w-72 lg:w-80 bg-slate-50 border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {sidebarContent}
      </aside>

      {/* Chart Section */}
      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden p-4 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl lg:text-2xl font-orbitron font-black text-slate-900 uppercase tracking-tight">LIVE_VISUALIZER</h2>
              <p className="text-[8px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Telemetry Projection</p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 w-full md:w-auto">
            <button
              onClick={() => { setLiveSync(!liveSync); if (!liveSync) { setLeft('dataMin'); setRight('dataMax'); } }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[9px] font-orbitron font-black uppercase transition-all border shadow-sm ${
                liveSync ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {liveSync ? <Unlock size={14} /> : <Lock size={14} />}
              <span className="whitespace-nowrap">{liveSync ? 'Live' : 'Locked'}</span>
            </button>
            {!liveSync && (
              <button onClick={() => { setLiveSync(true); setLeft('dataMin'); setRight('dataMax'); }} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-orbitron font-black uppercase tracking-widest transition-all shadow-sm">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-slate-50 rounded-[24px] lg:rounded-[32px] border border-slate-100 shadow-inner relative overflow-hidden flex flex-col">
          {selectedSignalNames.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-30">
              <Activity size={48} className="mb-6" />
              <h4 className="text-[10px] font-orbitron font-black uppercase tracking-[0.4em]">Ready_To_Project</h4>
              <p className="text-[8px] font-bold uppercase mt-2">Select items from the matrix</p>
              <button onClick={() => setIsSidebarOpen(true)} className="mt-6 lg:hidden px-6 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-orbitron font-black uppercase">Open Matrix</button>
            </div>
          ) : (
            <div className="flex-1 p-2 lg:p-4 cursor-crosshair">
              <div className="absolute top-4 right-6 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/90 border border-slate-200 rounded-lg text-[8px] font-mono text-slate-400 uppercase tracking-widest shadow-sm">
                <ZoomIn size={12} /> Drag to inspect
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={plotData} 
                  onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel ? Number(e.activeLabel) : null)}
                  onMouseMove={(e) => e && refAreaLeft !== null && setRefAreaRight(e.activeLabel ? Number(e.activeLabel) : null)}
                  onMouseUp={handleZoom}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} type="number" domain={[left, right]} allowDataOverflow tickFormatter={(val) => `${val.toFixed(1)}s`} />
                  <YAxis stroke="#94a3b8" fontSize={9} domain={['auto', 'auto']} allowDataOverflow width={35} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '12px', fontSize: '10px', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelFormatter={(val) => `Time: ${Number(val).toFixed(2)}s`}
                  />
                  <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                  {selectedSignalNames.map((sName, idx) => (
                    <Line key={sName} type="stepAfter" dataKey={sName} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
                  ))}
                  {refAreaLeft !== null && refAreaRight !== null && (
                    <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#4f46e5" fillOpacity={0.1} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveVisualizerDashboard;
