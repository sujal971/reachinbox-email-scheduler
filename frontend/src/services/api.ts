import axios from 'axios';
import { EmailJob, QueueStats, SlackStatus, User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const scheduleEmails = async (payload: {
  recipients?: string[];
  recipientEmail?: string;
  senderEmail?: string;
  subject: string;
  body: string;
  scheduledAt: string;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
  userId?: string;
}) => {
  const res = await api.post<{ message: string; count: number; jobs: any[] }>('/emails/schedule', payload);
  return res.data;
};

export const getScheduledEmails = async (page = 1, limit = 50, userId?: string) => {
  const res = await api.get<{ total: number; emails: EmailJob[] }>('/emails/scheduled', {
    params: { page, limit, userId },
  });
  return res.data;
};

export const getSentEmails = async (page = 1, limit = 50, userId?: string) => {
  const res = await api.get<{ total: number; emails: EmailJob[] }>('/emails/sent', {
    params: { page, limit, userId },
  });
  return res.data;
};

export const searchEmails = async (query: string, status?: string, userId?: string) => {
  const res = await api.get<{ source: string; total: number; emails: EmailJob[] }>('/emails/search', {
    params: { q: query, status, userId },
  });
  return res.data;
};

export const cancelEmail = async (id: string) => {
  const res = await api.delete<{ message: string; email: EmailJob }>(`/emails/${id}/cancel`);
  return res.data;
};

export const getStats = async () => {
  const res = await api.get<QueueStats>('/emails/stats');
  return res.data;
};

// Slack APIs
export const getSlackStatus = async (userId: string) => {
  const res = await api.get<SlackStatus>('/slack/status', { params: { userId } });
  return res.data;
};

export const getSlackAuthUrl = async (userId: string) => {
  const res = await api.get<{ authUrl: string }>('/slack/auth-url', { params: { userId } });
  return res.data;
};

export const connectSlackWebhook = async (userId: string, webhookUrl: string, channel?: string) => {
  const res = await api.post('/slack/webhook', { userId, webhookUrl, channel });
  return res.data;
};

export const disconnectSlack = async (userId: string) => {
  const res = await api.post('/slack/disconnect', { userId });
  return res.data;
};

export const sendSlackTestAlert = async (userId: string, senderEmail: string, limit = 50) => {
  const res = await api.post('/slack/test-alert', { userId, senderEmail, limit });
  return res.data;
};

// Auth API
export const loginWithGoogle = async (data: { credential?: string; accessToken?: string; userInfo?: any }) => {
  const res = await api.post<{ user: User }>('/auth/google', data);
  return res.data;
};

export default api;
