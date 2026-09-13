import React, { useState } from 'react';
import { X, MessageSquare, CheckCircle, ExternalLink, Zap, AlertCircle, Trash2 } from 'lucide-react';
import { SlackStatus } from '../types';
import { getSlackAuthUrl, connectSlackWebhook, disconnectSlack, sendSlackTestAlert } from '../services/api';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackStatus: SlackStatus;
  userId: string;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackStatus,
  userId,
  onStatusChange,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    try {
      const data = await getSlackAuthUrl(userId);
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      setMsg({
        type: 'error',
        text: err.response?.data?.error || 'OAuth requires SLACK_CLIENT_ID in backend .env. Use direct webhook below.',
      });
    }
  };

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setIsSubmitting(true);
    setMsg(null);
    try {
      await connectSlackWebhook(userId, webhookUrl.trim(), channel.trim());
      setMsg({ type: 'success', text: 'Slack successfully connected! Verification ping sent to your channel.' });
      onStatusChange();
      setWebhookUrl('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to connect Slack webhook.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSlack(userId);
      setMsg({ type: 'success', text: 'Slack disconnected.' });
      onStatusChange();
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Failed to disconnect Slack.' });
    }
  };

  const handleSendTestAlert = async () => {
    setIsSendingTest(true);
    setMsg(null);
    try {
      const res = await sendSlackTestAlert(userId, 'alex@outboxlabs.io', 50);
      setMsg({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Failed to send test alert.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-850 rounded-2xl border border-dark-700 w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4A154B] flex items-center justify-center text-white">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Slack Rate-Limit Integration</h2>
              <p className="text-[11px] text-slate-400">Receive live alerts when hourly send quotas hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {msg && (
            <div
              className={`flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-lg border ${
                msg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Current Status Card */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                Connection Status
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    slackStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className="text-xs font-bold text-white">
                  {slackStatus.connected ? 'Connected to Slack' : 'Not Connected'}
                </span>
              </div>
              {slackStatus.connected && (
                <p className="text-[11px] text-slate-400">
                  Target Channel: <span className="text-slate-200 font-mono">{slackStatus.channel || '#general'}</span>
                </p>
              )}
            </div>

            {slackStatus.connected && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendTestAlert}
                  disabled={isSendingTest}
                  className="flex items-center gap-1.5 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/40 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? 'Sending...' : 'Test Alert'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-dark-800 transition"
                  title="Disconnect Slack"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Method 1: Real OAuth Authorize Flow */}
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Option 1: Standard OAuth 2.0 Flow
            </span>
            <button
              onClick={handleOAuthConnect}
              className="w-full flex items-center justify-center gap-2 bg-[#4A154B] hover:bg-[#5b1a5c] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Connect Slack via OAuth</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-dark-700"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Or
            </span>
            <div className="flex-grow border-t border-dark-700"></div>
          </div>

          {/* Method 2: Direct Incoming Webhook (Instant live verifiable demo) */}
          <form onSubmit={handleWebhookSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Option 2: Direct Incoming Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Channel Name
              </label>
              <input
                type="text"
                placeholder="#email-alerts"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-accent transition"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !webhookUrl.trim()}
              className="w-full bg-dark-700 hover:bg-dark-600 disabled:opacity-40 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-lg border border-dark-600 transition"
            >
              {isSubmitting ? 'Verifying...' : 'Save & Connect Webhook'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SlackModal;
