import React from 'react';
import { EmailJob } from '../types';
import { Clock, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduledTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  onCancel: (id: string) => void;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onCancel,
  onRefresh,
  onOpenCompose,
}) => {
  if (isLoading) {
    return (
      <div className="bg-dark-850 rounded-xl border border-dark-700 p-8 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-dark-700">
          <div className="h-4 w-40 bg-dark-700 animate-pulse rounded"></div>
          <div className="h-4 w-20 bg-dark-700 animate-pulse rounded"></div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="space-y-2">
              <div className="h-4 w-60 bg-dark-700 animate-pulse rounded"></div>
              <div className="h-3 w-40 bg-dark-800 animate-pulse rounded"></div>
            </div>
            <div className="h-6 w-24 bg-dark-700 animate-pulse rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-dark-850 rounded-xl border border-dark-700 p-12 text-center flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-dark-700/60 border border-dark-600 flex items-center justify-center mb-4 text-amber-400">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No scheduled emails in queue</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Schedule autonomous email sequences with custom throttling, delays, and lead imports.
        </p>
        <button
          onClick={onOpenCompose}
          className="bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Schedule an Email
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RATE_LIMITED_RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/50 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3 h-3" /> Rescheduled (Rate Limit)
          </span>
        );
      case 'SENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-950/50 text-blue-400 border border-blue-800">
            <RefreshCw className="w-3 h-3 animate-spin" /> Sending...
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3 h-3 text-amber-400" /> Scheduled
          </span>
        );
    }
  };

  return (
    <div className="bg-dark-850 rounded-xl border border-dark-700 overflow-hidden shadow-sm">
      <div className="px-6 py-3.5 border-b border-dark-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          Queue: {emails.length} pending email{emails.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-dark-900/60 border-b border-dark-700 text-slate-400 font-semibold">
            <tr>
              <th className="py-3 px-6">Recipient Email</th>
              <th className="py-3 px-6">Sender</th>
              <th className="py-3 px-6">Subject</th>
              <th className="py-3 px-6">Scheduled Time</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/60 text-slate-200">
            {emails.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              return (
                <tr key={job.id} className="hover:bg-dark-800/40 transition">
                  <td className="py-3.5 px-6 font-medium text-slate-100">{job.recipientEmail}</td>
                  <td className="py-3.5 px-6 text-slate-400">{job.senderEmail}</td>
                  <td className="py-3.5 px-6 max-w-[240px] truncate text-slate-300" title={job.subject}>
                    {job.subject}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400 font-mono">
                    {format(scheduledDate, 'MMM dd, yyyy • hh:mm:ss a')}
                  </td>
                  <td className="py-3.5 px-6">{getStatusBadge(job.status)}</td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      onClick={() => onCancel(job.id)}
                      className="text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1 ml-auto transition"
                      title="Cancel this scheduled email"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduledTable;
