import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import bullBoardRouter from './routes/dashboardRoute';

dotenv.config();

export const app: Express = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// BullMQ Live Dashboard (Bull-Board)
app.use('/admin/queues', bullBoardRouter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);

// Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      bullBoard: '/admin/queues',
      apiEmails: '/api/emails',
      apiSlack: '/api/slack',
    },
  });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'ReachInbox Email Job Scheduler API',
    version: '1.0.0',
    bullBoardUrl: '/admin/queues',
    healthUrl: '/health',
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[App Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

export default app;
