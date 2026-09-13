import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import Papa from 'papaparse';
import { scheduleEmails } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
}

const SENDER_PRESETS = [
  'alex@outboxlabs.io',
  'growth@reachinbox.ai',
  'outreach@reachinbox.ai',
  'partnerships@outboxlabs.io',
];

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
}) => {
  const [senderEmail, setSenderEmail] = useState(SENDER_PRESETS[0]);
  const [customSender, setCustomSender] = useState('');
  const [isCustomSender, setIsCustomSender] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [parsedLeads, setParsedLeads] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Scheduling options
  const [startTimeMode, setStartTimeMode] = useState<'now' | 'custom'>('now');
  const [customStartTime, setCustomStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Extract all unique valid emails from text or rows
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          const rawText = JSON.stringify(results.data);
          const found = extractEmails(rawText);
          setParsedLeads(found);
        },
        error: (err) => {
          setErrorMsg(`Failed to parse CSV: ${err.message}`);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const found = extractEmails(text);
        setParsedLeads(found);
      };
      reader.readAsText(file);
    }
  };

  const getFinalRecipients = (): string[] => {
    const manualFound = extractEmails(manualRecipients);
    const combined = Array.from(new Set([...parsedLeads, ...manualFound]));
    return combined;
  };

  const finalRecipients = getFinalRecipients();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const activeSender = isCustomSender ? customSender.trim() : senderEmail;
    if (!activeSender) {
      setErrorMsg('Please provide a sender email address.');
      return;
    }

    if (!subject.trim()) {
      setErrorMsg('Please enter an email subject.');
      return;
    }

    if (!body.trim()) {
      setErrorMsg('Please enter the email body.');
      return;
    }

    if (finalRecipients.length === 0) {
      setErrorMsg('Please enter at least one recipient email or upload a lead file.');
      return;
    }

    let scheduledAt = new Date().toISOString();
    if (startTimeMode === 'custom') {
      const scheduledDate = new Date(customStartTime);
      if (isNaN(scheduledDate.getTime())) {
        setErrorMsg('Invalid custom start time selected.');
        return;
      }
      scheduledAt = scheduledDate.toISOString();
    }

    setIsSubmitting(true);
    try {
      await scheduleEmails({
        recipients: finalRecipients,
        senderEmail: activeSender,
        subject,
        body,
        scheduledAt,
        delayBetweenEmailsSeconds: delaySeconds,
        hourlyLimit,
        userId,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-dark-850 rounded-2xl border border-dark-700 w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-900/50">
          <div>
            <h2 className="text-base font-bold text-white">Compose & Schedule Sequence</h2>
            <p className="text-xs text-slate-400">Configure multi-recipient outreach with throttling</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs bg-rose-950/40 border border-rose-800 text-rose-300 px-3.5 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sender Selector (Multi-sender requirement) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">From (Sender Email)</label>
              <button
                type="button"
                onClick={() => setIsCustomSender(!isCustomSender)}
                className="text-[11px] text-brand-accent hover:underline"
              >
                {isCustomSender ? 'Choose from presets' : '+ Enter custom sender'}
              </button>
            </div>
            {isCustomSender ? (
              <input
                type="email"
                placeholder="e.g. outreach@reachinbox.ai"
                value={customSender}
                onChange={(e) => setCustomSender(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition"
              />
            ) : (
              <select
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-accent transition"
              >
                {SENDER_PRESETS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lead CSV/Text File Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Recipients & Leads
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* File drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-dark-700 hover:border-brand-accent/60 bg-dark-900/50 hover:bg-dark-900 rounded-lg p-4 text-center cursor-pointer transition flex flex-col items-center justify-center group"
              >
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand-accent mb-1.5 transition" />
                <span className="text-xs font-medium text-slate-300">
                  {fileName ? fileName : 'Upload CSV or TXT lead file'}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">Click to browse file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Manual input */}
              <div>
                <textarea
                  placeholder="Or enter recipient emails manually (comma or space separated)..."
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  rows={3}
                  className="w-full h-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition resize-none"
                />
              </div>
            </div>

            {/* Email Count Badge */}
            {finalRecipients.length > 0 && (
              <div className="mt-2.5 flex items-center justify-between bg-emerald-950/30 border border-emerald-800/60 px-3 py-1.5 rounded-lg text-xs text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <strong>{finalRecipients.length}</strong> email addresses detected and ready
                </span>
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  {finalRecipients.slice(0, 3).join(', ')}
                  {finalRecipients.length > 3 ? ` +${finalRecipients.length - 3} more` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Subject</label>
            <input
              type="text"
              placeholder="e.g. Scaling outreach with ReachInbox AI"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Body</label>
              <span className="text-[11px] text-slate-500">Supports text & variable tags</span>
            </div>
            <textarea
              placeholder="Hi there,&#10;&#10;I came across your profile and wanted to introduce ReachInbox..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition resize-none font-sans"
            />
          </div>

          {/* Throttling, Delay & Scheduling Controls */}
          <div className="bg-dark-900 p-4 rounded-xl border border-dark-700 space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Scheduling & Rate Limits
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Start Time */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Start Time
                </label>
                <div className="flex items-center gap-1 mb-1.5">
                  <button
                    type="button"
                    onClick={() => setStartTimeMode('now')}
                    className={`flex-1 text-[11px] py-1 rounded border transition ${
                      startTimeMode === 'now'
                        ? 'bg-brand-accent text-white border-brand-accent'
                        : 'bg-dark-800 text-slate-400 border-dark-700'
                    }`}
                  >
                    Immediate
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTimeMode('custom')}
                    className={`flex-1 text-[11px] py-1 rounded border transition ${
                      startTimeMode === 'custom'
                        ? 'bg-brand-accent text-white border-brand-accent'
                        : 'bg-dark-800 text-slate-400 border-dark-700'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {startTimeMode === 'custom' && (
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded px-2 py-1 text-xs text-slate-200"
                  />
                )}
              </div>

              {/* Delay between each email */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Delay Between Sends (sec)
                </label>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full bg-dark-800 border border-dark-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Minimum spacing between emails
                </span>
              </div>

              {/* Hourly limit */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Hourly Rate Limit
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full bg-dark-800 border border-dark-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Alerts Slack & auto-delays overflow
                </span>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-slate-400 hover:text-white px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-purple hover:opacity-95 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-brand-accent/25 transition active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Scheduling Sequence...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Schedule {finalRecipients.length > 0 ? `${finalRecipients.length} Email(s)` : 'Email'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
