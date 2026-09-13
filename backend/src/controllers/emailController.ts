import { Request, Response } from 'express';
import prisma from '../config/db';
import QueueService from '../services/queueService';
import ElasticService from '../services/elasticService';
import { EmailJobData } from '../types';

export class EmailController {
  /**
   * Schedule one or multiple emails (e.g. from lead CSV)
   */
  public static async scheduleEmails(req: Request, res: Response) {
    try {
      const {
        recipients,
        recipientEmail,
        senderEmail = 'alex@outboxlabs.io',
        subject,
        body,
        scheduledAt,
        delayBetweenEmailsSeconds = 2,
        hourlyLimit = 50,
        userId,
      } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ error: 'Subject and Body are required.' });
      }

      // Collect target recipients (support both array or single recipient)
      let recipientList: string[] = [];
      if (Array.isArray(recipients) && recipients.length > 0) {
        recipientList = recipients;
      } else if (recipientEmail) {
        recipientList = [recipientEmail];
      }

      // Filter and sanitize emails
      const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      recipientList = recipientList
        .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter((e) => validEmailRegex.test(e));

      if (recipientList.length === 0) {
        return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
      }

      const baseStartTime = scheduledAt ? new Date(scheduledAt) : new Date();
      if (isNaN(baseStartTime.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduledAt datetime.' });
      }

      const delayBetweenEmailsMs = Math.max(0, (delayBetweenEmailsSeconds || 2) * 1000);
      const parsedHourlyLimit = Math.max(1, parseInt(hourlyLimit || '50', 10));

      const createdJobs = [];

      // Create and schedule each job staggered by delayBetweenEmailsMs
      for (let i = 0; i < recipientList.length; i++) {
        const recipient = recipientList[i];
        const staggeredScheduledTime = new Date(baseStartTime.getTime() + i * delayBetweenEmailsMs);

        // 1. Create DB record
        const emailRecord = await prisma.emailJob.create({
          data: {
            userId: userId || null,
            senderEmail,
            recipientEmail: recipient,
            subject,
            body,
            scheduledAt: staggeredScheduledTime,
            status: 'SCHEDULED',
            hourlyLimit: parsedHourlyLimit,
            delayBetweenEmailsMs,
          },
        });

        // 2. Schedule delayed BullMQ job (No Cron)
        const jobData: EmailJobData = {
          id: emailRecord.id,
          userId: userId || undefined,
          senderEmail,
          recipientEmail: recipient,
          subject,
          body,
          scheduledAt: staggeredScheduledTime.toISOString(),
          hourlyLimit: parsedHourlyLimit,
          delayBetweenEmailsMs,
        };

        const bullJob = await QueueService.scheduleEmailJob(jobData, staggeredScheduledTime);

        // 3. Index in Elasticsearch
        await ElasticService.indexEmail(emailRecord);

        createdJobs.push({
          id: emailRecord.id,
          recipient: emailRecord.recipientEmail,
          scheduledAt: staggeredScheduledTime,
          bullJobId: bullJob.id,
        });
      }

      return res.status(201).json({
        message: `Successfully scheduled ${createdJobs.length} email(s).`,
        count: createdJobs.length,
        jobs: createdJobs,
      });
    } catch (err: any) {
      console.error('[EmailController] Scheduling error:', err.message);
      return res.status(500).json({ error: 'Failed to schedule emails', details: err.message });
    }
  }

  /**
   * Get scheduled emails list
   */
  public static async getScheduledEmails(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const userId = req.query.userId as string;

      const where: any = {
        status: { in: ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'SENDING'] },
      };
      if (userId) where.userId = userId;

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return res.json({
        total,
        page,
        limit,
        emails,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get sent emails list
   */
  public static async getSentEmails(req: Request, res: Response) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const userId = req.query.userId as string;

      const where: any = {
        status: { in: ['SENT', 'FAILED'] },
      };
      if (userId) where.userId = userId;

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return res.json({
        total,
        page,
        limit,
        emails,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Full-text search emails via Elasticsearch (with fallback)
   */
  public static async searchEmails(req: Request, res: Response) {
    try {
      const { q, status, userId, from = '0', size = '50' } = req.query;

      const results = await ElasticService.searchEmails({
        query: typeof q === 'string' ? q : undefined,
        status: typeof status === 'string' ? status : undefined,
        userId: typeof userId === 'string' ? userId : undefined,
        from: parseInt(from as string, 10),
        size: parseInt(size as string, 10),
      });

      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Cancel a scheduled email
   */
  public static async cancelEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cancelled = await QueueService.cancelJob(id);
      await ElasticService.updateEmailStatus(id, 'CANCELLED');

      return res.json({ message: 'Email cancelled successfully', email: cancelled });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  /**
   * Queue and system metrics
   */
  public static async getStats(req: Request, res: Response) {
    try {
      const queueMetrics = await QueueService.getMetrics();
      const [totalScheduled, totalSent, totalFailed, totalRescheduled] = await Promise.all([
        prisma.emailJob.count({ where: { status: 'SCHEDULED' } }),
        prisma.emailJob.count({ where: { status: 'SENT' } }),
        prisma.emailJob.count({ where: { status: 'FAILED' } }),
        prisma.emailJob.count({ where: { status: 'RATE_LIMITED_RESCHEDULED' } }),
      ]);

      return res.json({
        queue: queueMetrics,
        db: {
          scheduled: totalScheduled,
          sent: totalSent,
          failed: totalFailed,
          rescheduled: totalRescheduled,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}

export default EmailController;
