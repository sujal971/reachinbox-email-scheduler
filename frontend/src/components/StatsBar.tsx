import React from 'react';
import { QueueStats } from '../types';
import { Clock, Send, ShieldAlert, Cpu } from 'lucide-react';

interface StatsBarProps {
  stats: QueueStats | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {/* Scheduled */}
      <div className="bg-dark-850 border border-dark-700 rounded-xl p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Scheduled / Delayed
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            {stats.queue.delayed + stats.queue.waiting}
          </div>
        </div>
      </div>

      {/* Dispatched */}
      <div className="bg-dark-850 border border-dark-700 rounded-xl p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Send className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Sent via Ethereal
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            {stats.db.sent}
          </div>
        </div>
      </div>

      {/* Rescheduled on Rate Limit */}
      <div className="bg-dark-850 border border-dark-700 rounded-xl p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Rate-Limit Rescheduled
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            {stats.db.rescheduled}
          </div>
        </div>
      </div>

      {/* Worker Concurrency */}
      <div className="bg-dark-850 border border-dark-700 rounded-xl p-4 flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            BullMQ Concurrency
          </span>
          <div className="text-xl font-bold text-white tracking-tight">
            5 Parallel
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
