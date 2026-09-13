import { redisConnection } from '../config/redis';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextWindowMs?: number;
  nextWindowTime?: Date;
}

export class RateLimitService {
  /**
   * Generates the Redis key for a sender and hour window
   * Format: ratelimit:sender:{senderEmail}:{YYYY-MM-DDTHH}
   */
  private static getKey(senderEmail: string, date: Date = new Date()): string {
    const hourWindow = date.toISOString().slice(0, 13); // e.g. "2026-09-13T08"
    return `ratelimit:sender:${senderEmail.toLowerCase()}:${hourWindow}`;
  }

  /**
   * Calculates milliseconds until the top of the next hour
   */
  public static getNextHourWindowDelay(date: Date = new Date()): { delayMs: number; nextWindowTime: Date } {
    const nextWindow = new Date(date);
    nextWindow.setUTCMinutes(60, 0, 0);
    const delayMs = Math.max(1000, nextWindow.getTime() - Date.now());
    return { delayMs, nextWindowTime: nextWindow };
  }

  /**
   * Atomically checks and increments the hourly send count for a sender
   */
  public static async checkAndConsume(
    senderEmail: string,
    limitOverride?: number
  ): Promise<RateLimitCheckResult> {
    const defaultSenderLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);
    const limit = limitOverride && limitOverride > 0 ? limitOverride : defaultSenderLimit;

    const key = this.getKey(senderEmail);

    // Atomic INCR in Redis
    const count = await redisConnection.incr(key);

    // If key was just created, set 2 hour expiry (7200s)
    if (count === 1) {
      await redisConnection.expire(key, 7200);
    }

    if (count > limit) {
      // Revert the increment since the job cannot send in this window
      await redisConnection.decr(key);

      const { delayMs, nextWindowTime } = this.getNextHourWindowDelay();
      return {
        allowed: false,
        currentCount: count - 1,
        limit,
        nextWindowMs: delayMs,
        nextWindowTime,
      };
    }

    return {
      allowed: true,
      currentCount: count,
      limit,
    };
  }

  /**
   * Reads current hourly usage without incrementing
   */
  public static async getCurrentUsage(senderEmail: string): Promise<number> {
    const key = this.getKey(senderEmail);
    const val = await redisConnection.get(key);
    return val ? parseInt(val, 10) : 0;
  }
}

export default RateLimitService;
