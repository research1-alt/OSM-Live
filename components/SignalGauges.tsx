
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SignalGaugesProps {
  data: { rpm: number; temp: number; throttle: number; timestamp: number }[];
}

const Gauge: React.FC<{ label: string; value: string | number; unit: string; color: string; bgColor: string }> = ({ label, value, unit, color, bgColor }) => (
  <div className={`${bgColor} p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center shadow-sm`}>
    <span className="text-slate-400 text-[7px] font-black uppercase tracking-tighter mb-0.5 whitespace-nowrap">{label}</span>
    <div className="flex items-baseline gap-0.5">
      <span className={`text-sm font-orbitron font-black ${color}`}>{value}</span>
      <span className="text-[6px] text-slate-400 font-bold uppercase">{unit}</span>
    </div>
  </div>
);

const SignalGauges: React.FC<SignalGaugesProps> = ({ data }) => {
  const latest = data[data.length - 1] || { rpm: 0, temp: 0, throttle: 0 };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
        <Gauge label="Motor Speed" value={Math.round(latest.rpm)} unit="RPM" color="text-indigo-600" bgColor="bg-indigo-50/30" />
        <Gauge label="Core Temp" value={latest.temp.toFixed(1)} unit="°C" color="text-amber-600" bgColor="bg-amber-50/30" />
        <Gauge label="Throttle" value={Math.round(latest.throttle)} unit="%" color="text-emerald-600" bgColor="bg-emerald-50/30" />
      </div>
      
      <div className="bg-white p-2 rounded-xl border border-slate-200 h-24 shadow-sm relative overflow-hidden">
        <div className="absolute top-1.5 left-2.5 z-10">
          <h3 className="text-slate-400 text-[6px] font-black uppercase tracking-widest">Live_Waveform (RPM)</h3>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.slice(-50)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis hide dataKey="timestamp" />
            <YAxis hide domain={[0, 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '8px', fontSize: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', padding: '4px' }}
              labelStyle={{ display: 'none' }}
            />
            <Line type="monotone" dataKey="rpm" stroke="#4f46e5" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SignalGauges;
