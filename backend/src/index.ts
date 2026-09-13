import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import prisma from './config/db';
import { initElasticsearch } from './config/elastic';
import { createEmailWorker } from './workers/emailWorker';
import { redisConnection } from './config/redis';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('🚀 Starting ReachInbox Email Job Scheduler Backend...');
  console.log('----------------------------------------------------');

  try {
    // 1. Verify Database Connection
    await prisma.$connect();
    console.log('[Database] Connected successfully to PostgreSQL.');

    // 2. Initialize Elasticsearch Index
    await initElasticsearch();

    // 3. Start BullMQ Worker
    const worker = createEmailWorker();

    // 4. Start HTTP Server
    const server = app.listen(PORT, () => {
      console.log(`[Server] Express listening on http://localhost:${PORT}`);
      console.log(`[Dashboard] BullMQ Live Dashboard running at http://localhost:${PORT}/admin/queues`);
      console.log('----------------------------------------------------');
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await worker.close();
          console.log('[Worker] BullMQ Worker closed.');
          await redisConnection.quit();
          console.log('[Redis] Connection closed.');
          await prisma.$disconnect();
          console.log('[Database] Disconnected.');
          process.exit(0);
        } catch (err: any) {
          console.error('[Server] Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error: any) {
    console.error('[Server] Failed to bootstrap application:', error);
    process.exit(1);
  }
}

bootstrap();
