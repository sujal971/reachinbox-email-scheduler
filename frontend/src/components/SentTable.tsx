import React from 'react';
import { EmailJob } from '../types';
import { CheckCircle2, XCircle, ExternalLink, Send, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  emails: EmailJob[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading,
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
        <div className="w-14 h-14 rounded-full bg-dark-700/60 border border-dark-600 flex items-center justify-center mb-4 text-emerald-400">
          <Send className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No sent emails yet</h3>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Sent emails will appear here once processed by the BullMQ worker. You will receive direct Ethereal preview links.
        </p>
        <button
          onClick={onOpenCompose}
          className="bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Send Your First Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-dark-850 rounded-xl border border-dark-700 overflow-hidden shadow-sm">
      <div className="px-6 py-3.5 border-b border-dark-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          History: {emails.length} dispatched email{emails.length === 1 ? '' : 's'}
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
              <th className="py-3 px-6">Sent Time</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/60 text-slate-200">
            {emails.map((job) => {
              const sentDate = job.sentAt ? new Date(job.sentAt) : new Date(job.updatedAt);
              return (
                <tr key={job.id} className="hover:bg-dark-800/40 transition">
                  <td className="py-3.5 px-6 font-medium text-slate-100">{job.recipientEmail}</td>
                  <td className="py-3.5 px-6 text-slate-400">{job.senderEmail}</td>
                  <td className="py-3.5 px-6 max-w-[240px] truncate text-slate-300" title={job.subject}>
                    {job.subject}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400 font-mono">
                    {format(sentDate, 'MMM dd, yyyy • hh:mm:ss a')}
                  </td>
                  <td className="py-3.5 px-6">
                    {job.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Sent
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/50 text-rose-400 border border-rose-800"
                        title={job.errorMessage || 'Failed to dispatch'}
                      >
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-brand-accent hover:text-white bg-dark-700 hover:bg-dark-600 px-2.5 py-1 rounded border border-dark-600 transition font-medium"
                      >
                        <span>View Email</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[11px]">N/A</span>
                    )}
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

export default SentTable;
