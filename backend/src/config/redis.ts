import Redis, { RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

export const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => {
  console.log(`[Redis] Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

export const getNewRedisConnection = () => new Redis(redisConfig);

export default redisConfig;
