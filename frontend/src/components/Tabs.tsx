import React from 'react';
import { Clock, Send, Plus } from 'lucide-react';

interface TabsProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  scheduledCount: number;
  sentCount: number;
  onOpenCompose: () => void;
}

export const Tabs: React.FC<TabsProps> = ({
  activeTab,
  onTabChange,
  scheduledCount,
  sentCount,
  onOpenCompose,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-dark-700">
      {/* Tab Selectors */}
      <div className="flex items-center gap-2 bg-dark-850 p-1 rounded-lg border border-dark-700 w-fit">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${
            activeTab === 'scheduled'
              ? 'bg-dark-700 text-white shadow-sm border border-dark-600'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Scheduled Emails</span>
          <span
            className={`ml-1 text-[11px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'scheduled'
                ? 'bg-amber-400/20 text-amber-300 font-bold'
                : 'bg-dark-800 text-slate-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${
            activeTab === 'sent'
              ? 'bg-dark-700 text-white shadow-sm border border-dark-600'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sent Emails</span>
          <span
            className={`ml-1 text-[11px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'sent'
                ? 'bg-emerald-400/20 text-emerald-300 font-bold'
                : 'bg-dark-800 text-slate-400'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </div>

      {/* Primary Action Button: Compose New Email */}
      <button
        onClick={onOpenCompose}
        className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-accent to-brand-purple hover:opacity-95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg shadow-brand-accent/25 transition active:scale-[0.98]"
      >
        <Plus className="w-4 h-4" />
        <span>Compose New Email</span>
      </button>
    </div>
  );
};

export default Tabs;
