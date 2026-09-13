import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EMAIL_QUEUE_NAME } from '../services/queueService';
import { EmailJobData } from '../types';
import prisma from '../config/db';
import { sendEmailViaEthereal } from '../services/etherealService';
import RateLimitService from '../services/rateLimitService';
import SlackService from '../services/slackService';
import QueueService from '../services/queueService';
import ElasticService from '../services/elasticService';

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const defaultThrottleDelayMs = parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10);

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { id, senderEmail, recipientEmail, subject, body, hourlyLimit, delayBetweenEmailsMs, userId } = job.data;
      console.log(`[Worker] Processing job ${job.id} for email ID ${id} to ${recipientEmail}`);

      // 1. Idempotency Check in Database
      const existingRecord = await prisma.emailJob.findUnique({
        where: { id },
      });

      if (!existingRecord) {
        console.warn(`[Worker] Email record ${id} not found in database. Skipping.`);
        return { status: 'SKIPPED_NOT_FOUND' };
      }

      if (existingRecord.status === 'SENT') {
        console.log(`[Worker] Email ${id} has already been sent. Skipping duplicate send (Idempotency safe).`);
        return { status: 'ALREADY_SENT', previewUrl: existingRecord.etherealPreviewUrl };
      }

      if (existingRecord.status === 'CANCELLED') {
        console.log(`[Worker] Email ${id} was cancelled by user. Skipping.`);
        return { status: 'CANCELLED' };
      }

      // 2. Hourly Rate Limiting Check (Multi-worker safe via atomic Redis counters)
      const rateLimit = await RateLimitService.checkAndConsume(senderEmail, hourlyLimit);

      if (!rateLimit.allowed) {
        console.warn(
          `[Worker] Rate limit reached for sender ${senderEmail} (${rateLimit.limit}/hr). Rescheduling job ${id} into next hour window.`
        );

        // A. Trigger live Slack notification on rate limit hit
        await SlackService.notifyRateLimitHit({
          senderEmail,
          hourlyLimit: rateLimit.limit,
          currentCount: rateLimit.currentCount,
          nextAvailableWindowTime: rateLimit.nextWindowTime!,
          userId,
        });

        // B. Reschedule into the next hour window preserving job order (Do NOT drop or permanently fail)
        await QueueService.rescheduleForNextWindow(job.data, rateLimit.nextWindowMs!, rateLimit.nextWindowTime!);

        // C. Update Elasticsearch status
        await ElasticService.updateEmailStatus(id, 'RATE_LIMITED_RESCHEDULED');

        return {
          status: 'RATE_LIMITED_RESCHEDULED',
          nextWindowTime: rateLimit.nextWindowTime,
        };
      }

      // 3. Minimum Delay Between Individual Email Sends (Provider Throttling)
      const throttleDelay = delayBetweenEmailsMs || defaultThrottleDelayMs;
      if (throttleDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
      }

      // Mark as SENDING in DB
      await prisma.emailJob.update({
        where: { id },
        data: { status: 'SENDING' },
      });

      // 4. Send Email via Fake SMTP (Ethereal Email)
      try {
        const result = await sendEmailViaEthereal({
          senderEmail,
          recipientEmail,
          subject,
          body,
        });

        const sentAt = new Date();

        // 5. Update Database Record
        await prisma.emailJob.update({
          where: { id },
          data: {
            status: 'SENT',
            sentAt,
            etherealPreviewUrl: result.previewUrl ? result.previewUrl : null,
          },
        });

        // 6. Update Elasticsearch Document
        await ElasticService.updateEmailStatus(id, 'SENT', sentAt);

        console.log(`[Worker] Successfully sent email ${id} to ${recipientEmail}`);
        return {
          status: 'SENT',
          messageId: result.messageId,
          previewUrl: result.previewUrl,
        };
      } catch (sendError: any) {
        console.error(`[Worker] Failed to send email ${id} to ${recipientEmail}:`, sendError.message);

        // Update DB with failure details
        await prisma.emailJob.update({
          where: { id },
          data: {
            status: 'FAILED',
            errorMessage: sendError.message,
          },
        });

        await ElasticService.updateEmailStatus(id, 'FAILED');
        throw sendError; // Triggers BullMQ retry backoff
      }
    },
    {
      connection: redisConnection,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log(`[Worker] Email worker started with concurrency = ${concurrency}`);
  return worker;
}

export default createEmailWorker;
