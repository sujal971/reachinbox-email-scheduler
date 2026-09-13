export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

export interface EmailJob {
  id: string;
  userId?: string | null;
  bullJobId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED_RESCHEDULED' | 'CANCELLED';
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueueStats {
  queue: {
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  };
  db: {
    scheduled: number;
    sent: number;
    failed: number;
    rescheduled: number;
  };
}

export interface SlackStatus {
  connected: boolean;
  channel?: string | null;
  teamName?: string | null;
  connectedAt?: string | null;
}
