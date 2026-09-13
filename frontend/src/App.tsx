import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import Tabs from './components/Tabs';
import SearchBar from './components/SearchBar';
import ScheduledTable from './components/ScheduledTable';
import SentTable from './components/SentTable';
import ComposeModal from './components/ComposeModal';
import SlackModal from './components/SlackModal';
import LoginModal from './components/LoginModal';
import { useAuth } from './context/AuthContext';
import { EmailJob, QueueStats, SlackStatus } from './types';
import {
  getScheduledEmails,
  getSentEmails,
  getStats,
  getSlackStatus,
  cancelEmail,
  searchEmails,
} from './services/api';
import { CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailJob[]>([]);
  const [searchSource, setSearchSource] = useState<string>('');

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check URL params for Slack OAuth return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slack') === 'connected') {
      showToast('🎉 Slack connected successfully! Rate limit alerts are active.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch all core data
  const fetchData = useCallback(async () => {
    try {
      const [schedRes, sentRes, statsRes, slackRes] = await Promise.all([
        getScheduledEmails(1, 100),
        getSentEmails(1, 100),
        getStats().catch(() => null),
        getSlackStatus(user?.id || 'default-user').catch(() => ({ connected: false })),
      ]);

      setScheduledEmails(schedRes.emails || []);
      setSentEmails(sentRes.emails || []);
      if (statsRes) setStats(statsRes);
      if (slackRes) setSlackStatus(slackRes);
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial load and real-time interval polling (every 4 seconds)
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle Elasticsearch search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await searchEmails(query.trim());
      setSearchResults(res.emails || []);
      setSearchSource(res.source);
    } catch (err) {
      console.error('[Search] Error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Cancel Email
  const handleCancelEmail = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel this scheduled email?')) {
      try {
        await cancelEmail(id);
        showToast('Email cancelled successfully');
        fetchData();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to cancel email');
      }
    }
  };

  // Filtered lists depending on active search
  const displayedScheduled = searchQuery.trim()
    ? searchResults.filter((e) => ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'SENDING'].includes(e.status))
    : scheduledEmails;

  const displayedSent = searchQuery.trim()
    ? searchResults.filter((e) => ['SENT', 'FAILED'].includes(e.status))
    : sentEmails;

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenLoginModal={() => setIsLoginOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* Toast Notification */}
        {toast && (
          <div className="mb-6 flex items-center gap-2.5 bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-top-4 duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        )}

        {/* System Stats Overview */}
        <StatsBar stats={stats} />

        {/* Tab Selection & Compose CTA */}
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          scheduledCount={scheduledEmails.length}
          sentCount={sentEmails.length}
          onOpenCompose={() => setIsComposeOpen(true)}
        />

        {/* Elasticsearch Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          isSearching={isSearching}
          searchSource={searchSource}
          totalResults={
            searchQuery.trim()
              ? activeTab === 'scheduled'
                ? displayedScheduled.length
                : displayedSent.length
              : undefined
          }
        />

        {/* Tables Content */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={displayedScheduled}
            isLoading={isLoading}
            onCancel={handleCancelEmail}
            onRefresh={fetchData}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={displayedSent}
            isLoading={isLoading}
            onRefresh={fetchData}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 py-5 text-center text-xs text-slate-400">
        ReachInbox Autonomous Email Job Scheduler • Powered by BullMQ, Redis, PostgreSQL, Elasticsearch & Ethereal SMTP
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          showToast('Emails scheduled successfully into BullMQ queue');
          fetchData();
        }}
        userId={user?.id}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackStatus={slackStatus}
        userId={user?.id || 'default-user'}
        onStatusChange={fetchData}
      />

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
};

export default App;
