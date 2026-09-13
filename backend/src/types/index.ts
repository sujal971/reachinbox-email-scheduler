export interface ScheduleEmailPayload {
  recipientEmail: string;
  senderEmail?: string;
  subject: string;
  body: string;
  scheduledAt: string | Date;
  hourlyLimit?: number;
  delayBetweenEmailsMs?: number;
}

export interface BatchSchedulePayload {
  recipients: string[];
  senderEmail?: string;
  subject: string;
  body: string;
  scheduledAt: string | Date;
  delayBetweenEmailsSeconds?: number;
  hourlyLimit?: number;
}

export interface EmailJobData {
  id: string; // Database EmailJob UUID
  userId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
}

export interface EmailSearchQuery {
  query?: string;
  status?: string;
  userId?: string;
  from?: number;
  size?: number;
}

export interface SlackNotificationPayload {
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  nextAvailableWindowTime: string;
  rescheduledCount: number;
}
