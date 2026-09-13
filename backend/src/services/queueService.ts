import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EmailJobData } from '../types';
import prisma from '../config/db';

export const EMAIL_QUEUE_NAME = 'emailQueue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // Keep in queue for bull-board inspection
    removeOnFail: false,
  },
});

export class QueueService {
  /**
   * Adds an email job to BullMQ with a calculated delay (No Cron)
   * Using data.id as the BullMQ jobId guarantees idempotency.
   */
  public static async scheduleEmailJob(data: EmailJobData, scheduledAt: Date) {
    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

    const job = await emailQueue.add('sendEmail', data, {
      delay: delayMs,
      jobId: data.id, // Idempotency key: prevents duplicate jobs in Redis
    });

    // Save the BullMQ job id in DB
    await prisma.emailJob.update({
      where: { id: data.id },
      data: { bullJobId: job.id },
    });

    console.log(`[QueueService] Scheduled email ${data.id} for recipient ${data.recipientEmail} with delay ${delayMs}ms (BullMQ Job ID: ${job.id})`);
    return job;
  }

  /**
   * Reschedules an existing job into the next available hour window due to rate limits
   */
  public static async rescheduleForNextWindow(data: EmailJobData, delayMs: number, nextWindowTime: Date) {
    // Generate a unique rescheduled job id while preserving base job reference
    const rescheduledJobId = `${data.id}_reschedule_${Date.now()}`;

    const job = await emailQueue.add('sendEmail', data, {
      delay: delayMs,
      jobId: rescheduledJobId,
    });

    // Update DB status and new scheduled time
    await prisma.emailJob.update({
      where: { id: data.id },
      data: {
        status: 'RATE_LIMITED_RESCHEDULED',
        scheduledAt: nextWindowTime,
        bullJobId: job.id,
      },
    });

    console.log(`[QueueService] Rescheduled email ${data.id} into next hour window in ${Math.round(delayMs / 1000)}s (New Job ID: ${job.id})`);
    return job;
  }

  /**
   * Cancels a scheduled job
   */
  public static async cancelJob(emailJobId: string) {
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
    });

    if (!emailJob) {
      throw new Error('Email job not found');
    }

    if (emailJob.status === 'SENT') {
      throw new Error('Cannot cancel an already sent email');
    }

    if (emailJob.bullJobId) {
      try {
        const job = await emailQueue.getJob(emailJob.bullJobId);
        if (job) {
          await job.remove();
        }
      } catch (err: any) {
        console.warn(`[QueueService] Could not remove BullMQ job ${emailJob.bullJobId}:`, err.message);
      }
    }

    const updated = await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }

  /**
   * Returns current queue metrics for monitoring
   */
  public static async getMetrics() {
    const [waiting, delayed, active, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return {
      waiting,
      delayed,
      active,
      completed,
      failed,
      total: waiting + delayed + active + completed + failed,
    };
  }
}

export default QueueService;
