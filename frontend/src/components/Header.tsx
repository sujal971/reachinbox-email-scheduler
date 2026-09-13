import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Activity, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { SlackStatus } from '../types';

interface HeaderProps {
  slackStatus: SlackStatus;
  onOpenSlackModal: () => void;
  onOpenLoginModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  slackStatus,
  onOpenSlackModal,
  onOpenLoginModal,
}) => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="border-b border-dark-700 bg-dark-850/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-accent to-brand-purple flex items-center justify-center font-bold text-white shadow-lg shadow-brand-accent/20">
            RI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">ReachInbox</h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400">Outbox Labs Autonomous Email Engine</p>
          </div>
        </div>

        {/* Action Controls & User */}
        <div className="flex items-center gap-4">
          {/* Live Queue Monitor (Bull-board) link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-dark-700 hover:bg-dark-600 px-3 py-1.5 rounded-md border border-dark-600 transition"
            title="Open Live BullMQ Dashboard"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>BullMQ Live</span>
          </a>

          {/* Slack Integration Button / Badge */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border transition ${
              slackStatus.connected
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-dark-700 border-dark-600 text-slate-300 hover:bg-dark-600 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#4A154B]" />
            <span>
              {slackStatus.connected ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Slack Alert Active
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" /> Connect Slack
                </span>
              )}
            </span>
          </button>

          {/* User Profile / Login */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-dark-700">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full border border-dark-600 object-cover bg-dark-800"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200">{user.name || 'User'}</div>
                <div className="text-[11px] text-slate-400 max-w-[150px] truncate">{user.email}</div>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-dark-700 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="text-xs font-medium bg-brand-accent hover:bg-brand-accent/90 text-white px-3 py-1.5 rounded-md transition"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
