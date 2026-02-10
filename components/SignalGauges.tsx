
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SignalGaugesProps {
  data: { rpm: number; temp: number; throttle: number; timestamp: number }[];
}

const Gauge: React.FC<{ label: string; value: string | number; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center space-y-2">
    <span className="text-slate-400 text-xs font-semibold uppercase">{label}</span>
    <span className={`text-3xl font-bold ${color}`}>{value}</span>
    <span className="text-slate-500 text-xs">{unit}</span>
  </div>
);

const SignalGauges: React.FC<SignalGaugesProps> = ({ data }) => {
  const latest = data[data.length - 1] || { rpm: 0, temp: 0, throttle: 0 };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Gauge label="Engine Speed" value={latest.rpm} unit="RPM" color="text-emerald-400" />
      <Gauge label="Coolant Temp" value={latest.temp} unit="°C" color="text-amber-400" />
      <Gauge label="Throttle" value={latest.throttle} unit="%" color="text-blue-400" />
      
      <div className="md:col-span-3 bg-slate-800 p-4 rounded-xl border border-slate-700 h-64">
        <h3 className="text-slate-300 text-sm font-bold mb-4">Live Waveform (RPM)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.slice(-50)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis hide dataKey="timestamp" />
            <YAxis stroke="#64748b" fontSize={10} domain={[0, 8000]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="rpm" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SignalGauges;
