# 🚀 ReachInbox Full-Stack Email Job Scheduler

A production-grade, distributed email job scheduler service and interactive dashboard built for [ReachInbox.ai](https://reachinbox.ai).

The system accepts email scheduling requests via APIs and CSV lead uploads, schedules them at specific times using **BullMQ delayed jobs (no cron jobs)**, persists state in **PostgreSQL** and **Redis**, sends emails from multiple senders using fake SMTP (**Ethereal Email**), makes all emails searchable via **Elasticsearch**, and enforces multi-worker safe **hourly rate limits** with live verifiable **Slack OAuth / Webhook alerts**.

---

## 📑 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Key Features Matrix](#-key-features-matrix)
- [Tech Stack](#-tech-stack)
- [Quick Start Guide](#-quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [1. Infrastructure (Docker Compose)](#1-infrastructure-docker-compose)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Core Scheduler Design & Constraints](#-core-scheduler-design--constraints)
  - [1. Zero Cron Scheduling](#1-zero-cron-scheduling)
  - [2. Persistence on Restart & Idempotency](#2-persistence-on-restart--idempotency)
  - [3. Worker Concurrency & Provider Throttle Delay](#3-worker-concurrency--provider-throttle-delay)
  - [4. Hourly Rate Limiting & Zero-Drop Rescheduling](#4-hourly-rate-limiting--zero-drop-rescheduling)
  - [5. Slack Notification on Rate Limit Hit](#5-slack-notification-on-rate-limit-hit)
  - [6. Elasticsearch Indexing & Full-Text Search](#6-elasticsearch-indexing--full-text-search)
  - [7. Multi-Sender Ethereal SMTP with Preview Links](#7-multi-sender-ethereal-smtp-with-preview-links)
  - [8. BullMQ Live Dashboard](#8-bullmq-live-dashboard)
- [Demo Walkthrough Guide (Video Checklist)](#-demo-walkthrough-guide-video-checklist)
- [Repository Structure](#-repository-structure)
- [Collaborators & Submission](#-collaborators--submission)

---

## 🏛 Architecture Overview

```
                      +---------------------------------------+
                      |         React + Tailwind Dashboard     |
                      |   - Google Login & User Header        |
                      |   - Compose Email & CSV Leads Parser   |
                      |   - Scheduled & Sent Emails (ES Search)|
                      |   - Slack OAuth Connect & Bull-Board  |
                      +-------------------+-------------------+
                                          | REST API (port 5000)
                                          v
                      +---------------------------------------+
                      |        Express.js Backend (TS)        |
                      |   - Auth & User Controller            |
                      |   - Email Scheduling Controller       |
                      |   - Slack OAuth & Webhook Controller  |
                      |   - Live BullMQ Dashboard Route       |
                      +---------+---------+---------+---------+
                                |         |         |
           +--------------------+         |         +--------------------+
           |                              |                              |
           v                              v                              v
+--------------------+         +--------------------+         +--------------------+
|  PostgreSQL (DB)   |         |    Redis 7.x       |         | Elasticsearch 8.x  |
| - Users            |         | - BullMQ Queues    |         | - emails index     |
| - EmailJobs        |         | - Rate Limit Keys  |         | - Full-text search |
| - SlackIntegration |         | - Throttle Locks   |         |                    |
+--------------------+         +----------+---------+         +--------------------+
                                          |
                                          v
                               +--------------------+
                               |   BullMQ Worker    |
                               | - Concurrency (5)  |
                               | - Provider Delay   |
                               | - Rate Limit Check |
                               | - Reschedule Logic |
                               +----------+---------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             +--------------------+              +--------------------+
             | Ethereal SMTP      |              | Slack API          |
             | (Multiple Senders) |              | (Rate Limit Alert) |
             +--------------------+              +--------------------+
```

---

## 🌟 Key Features Matrix

| Requirement | Implementation Details | Status |
| :--- | :--- | :--- |
| **Zero Cron Scheduling** | BullMQ delayed jobs with calculated delay `Math.max(0, targetTime - Date.now())`. No cron libraries. | ✅ Verified |
| **Persistence Across Restarts** | Redis persists delayed & waiting job states. DB records tracked. Stopped server resumes pending jobs at exact time. | ✅ Verified |
| **Idempotency** | BullMQ `jobId = emailJob.id` prevents duplicate queue insertion. Worker checks DB status before sending. | ✅ Verified |
| **Worker Concurrency** | Configurable concurrency on BullMQ worker (`WORKER_CONCURRENCY=5`). Safe for parallel processing. | ✅ Verified |
| **Delay Between Each Email** | Configurable minimum delay (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`) to mimic provider throttling. | ✅ Verified |
| **Hourly Rate Limiting** | Redis atomic counter `ratelimit:sender:{email}:{hour}`. Jobs exceeding limit are safely delayed to next hour window. | ✅ Verified |
| **Slack Rate Limit Notification** | Live call to Slack incoming webhook / OAuth integration the moment a sender reaches quota. Debounced. | ✅ Verified |
| **Elasticsearch Search** | Emails indexed to `emails` index in Elasticsearch 8.11 with multi-field search and fallback. | ✅ Verified |
| **Live BullMQ Dashboard** | Integrated `@bull-board/express` mounted at `/admin/queues` with real-time job inspector. | ✅ Verified |
| **Multi-Sender Ethereal SMTP** | Sends from multiple custom or preset sender addresses with direct clickable Ethereal preview URLs. | ✅ Verified |
| **CSV Lead File Parser** | Drag-and-drop CSV/TXT leads parser with instant detection of email count. | ✅ Verified |
| **Google OAuth Login** | Real Google OAuth login flow with user profile avatar, name, and logout. | ✅ Verified |

---

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Queue / Scheduler**: BullMQ, Redis 7 (via `ioredis`)
- **Database / ORM**: PostgreSQL 16, Prisma ORM
- **Search Engine**: Elasticsearch 8.11 (`@elastic/elasticsearch`)
- **SMTP**: Ethereal Email (fake SMTP via `nodemailer`)
- **Queue Monitor**: `@bull-board/express` & `@bull-board/api`
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, PapaParse, Date-fns
- **Authentication**: `@react-oauth/google`

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ (tested on v22.12.0)
- Docker & Docker Compose (or WSL2 / native Redis, Postgres, Elasticsearch)

### 1. Infrastructure (Docker Compose)
Start PostgreSQL, Redis, and Elasticsearch using the included `docker-compose.yml`:

```bash
docker compose up -d
```

Verify services are running:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Elasticsearch: `localhost:9200`

---

### 2. Backend Setup

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development

   # PostgreSQL
   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/reachinbox_db?schema=public"

   # Redis
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379

   # Elasticsearch
   ELASTICSEARCH_NODE=http://127.0.0.1:9200

   # Worker & Rate Limiting
   WORKER_CONCURRENCY=5
   MIN_DELAY_BETWEEN_EMAILS_MS=2000
   MAX_EMAILS_PER_HOUR=200
   MAX_EMAILS_PER_HOUR_PER_SENDER=50

   # Slack OAuth (Optional for custom Slack App)
   SLACK_CLIENT_ID=
   SLACK_CLIENT_SECRET=
   SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
   FRONTEND_URL=http://localhost:5173
   ```

4. Push Prisma schema to PostgreSQL:
   ```bash
   npx prisma db push
   ```

5. Start the backend:
   ```bash
   # Development (with nodemon)
   npm run dev

   # Or production build & start
   npm run build
   npm start
   ```

Backend endpoints:
- API Base: `http://localhost:5000/api`
- Healthcheck: `http://localhost:5000/health`
- Live BullMQ Dashboard: `http://localhost:5000/admin/queues`

---

### 3. Frontend Setup

1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment in `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_GOOGLE_CLIENT_ID=
   ```

4. Start the frontend dev server:
   ```bash
   npm run dev
   ```

Access the dashboard at: **`http://localhost:5173`**

---

## 🧠 Core Scheduler Design & Constraints

### 1. Zero Cron Scheduling
No OS cron or Node cron libraries (`node-cron`, `agenda`) are used.
Scheduling is handled purely through BullMQ's native delayed job scheduler:
```typescript
const delayMs = Math.max(0, targetScheduledDate.getTime() - Date.now());

await emailQueue.add('sendEmail', jobData, {
  delay: delayMs,
  jobId: emailJob.id, // Idempotency key
});
```
BullMQ schedules jobs in Redis sorted sets (`wait`, `delayed`), automatically transitioning jobs to the `active` queue when the exact delay expires.

### 2. Persistence on Restart & Idempotency
- **Persistence**: Redis persists all delayed and waiting job keys across server and worker restarts. When the backend or worker restarts, BullMQ reads existing delayed jobs from Redis and executes them at the exact scheduled timestamp.
- **Idempotency**:
  1. Passing `jobId: emailJob.id` into BullMQ guarantees Redis never stores duplicate jobs for the same email.
  2. The BullMQ worker checks PostgreSQL before sending:
     ```typescript
     const existing = await prisma.emailJob.findUnique({ where: { id } });
     if (existing.status === 'SENT') return; // Skips duplicate send
     ```

### 3. Worker Concurrency & Provider Throttle Delay
- **Concurrency**: Configured via `WORKER_CONCURRENCY` (default: 5 parallel workers).
- **Provider Throttle**: Between individual email sends, the worker enforces a configurable minimum delay (default: 2000ms):
  ```typescript
  const throttleDelay = delayBetweenEmailsMs || defaultThrottleDelayMs;
  await new Promise((resolve) => setTimeout(resolve, throttleDelay));
  ```

### 4. Hourly Rate Limiting & Zero-Drop Rescheduling
Rate limiting is enforced per-sender across all worker instances using atomic Redis counters:
- **Redis Key**: `ratelimit:sender:{senderEmail}:{YYYY-MM-DDTHH}` with a 2-hour TTL.
- **Atomic Increment**:
  ```typescript
  const count = await redis.incr(key);
  if (count > limit) {
    await redis.decr(key); // Rollback counter
    const delayMs = getNextHourWindowDelay();
    
    // Reschedule into next hour window (Never drop or fail)
    await QueueService.rescheduleForNextWindow(job.data, delayMs, nextWindowTime);
    await SlackService.notifyRateLimitHit(...);
  }
  ```
- **Zero-Drop Guarantee**: Jobs exceeding the hourly limit are never discarded or marked as failed. They are rescheduled into the next hour window (`status: RATE_LIMITED_RESCHEDULED`) while preserving send order.

### 5. Slack Notification on Rate Limit Hit
- **Connection**: Supports both real Slack OAuth 2.0 (`/api/slack/auth` -> callback -> token exchange) and direct Incoming Webhook URLs for instant live verifiable demonstration.
- **Live Verifiable Alert**: The moment a sender's hourly limit is reached, a formatted Slack block message is dispatched immediately:
  - Sender email address
  - Hourly quota limit
  - Number of emails rescheduled
  - Next available sending window timestamp
- **Graceful Handling**: If Slack is not connected, rate-limit hits log cleanly without crashing. When connected later, alerts begin working immediately without requiring a restart.
- **Debounce**: A 15-minute Redis debounce key prevents alert flooding when hundreds of jobs hit the limit concurrently.

### 6. Elasticsearch Indexing & Full-Text Search
All scheduled and sent emails are indexed into Elasticsearch 8.11:
- **Index**: `emails`
- **Fields**: `recipientEmail`, `senderEmail`, `subject`, `body`, `status`, `scheduledAt`, `sentAt`
- **Search Query**: Multi-match query across `recipientEmail^3`, `subject^2`, `senderEmail`, and `body` with fuzziness.
- **Fallback**: If Elasticsearch is initializing or offline, queries automatically fallback to PostgreSQL queries so the dashboard never breaks.

### 7. Multi-Sender Ethereal SMTP with Preview Links
- Sends emails from multiple sender accounts (e.g. `alex@outboxlabs.io`, `growth@reachinbox.ai`, `outreach@reachinbox.ai`).
- Generates live Ethereal test messages via `nodemailer`.
- The dashboard table includes a direct **"View Email"** button linking to the rendered HTML preview on `ethereal.email`.

### 8. BullMQ Live Dashboard
Mounted at `http://localhost:5000/admin/queues` using `@bull-board/express`, allowing reviewers to inspect Active, Waiting, Delayed, Completed, and Failed jobs in real time.

---

## 📹 Demo Walkthrough Guide (Video Checklist)

For the short demo video (< 5 minutes), here is the step-by-step flow:

1. **Dashboard Tour**:
   - Open `http://localhost:5173`. Show top header with Google user profile (Alex Morgan), Slack status, and live BullMQ link.
   - Show the Stats overview cards.
2. **Scheduling Emails & CSV Lead Parsing**:
   - Click "Compose New Email".
   - Upload `sample_leads.csv`. Highlight the green badge showing **5 email addresses detected**.
   - Select sender `alex@outboxlabs.io`, set delay to 2 seconds, and click "Schedule".
   - Switch to "Scheduled Emails" tab to see the staggered queue.
3. **Sent Emails & Ethereal Preview**:
   - Switch to "Sent Emails" tab. Watch emails appear as `SENT`.
   - Click the **"View Email"** button on a sent email to open the rendered message on `ethereal.email`.
4. **Server Restart Persistence Test**:
   - Schedule an email 30 seconds into the future.
   - Stop the backend terminal (`Ctrl+C`). Show that `localhost:5000/health` is down.
   - Start the backend again (`npm start`).
   - Show that when the scheduled time arrives, the email sends successfully without being lost or duplicated.
5. **Rate Limiting & Live Slack Alert**:
   - Open the "Connect Slack" modal. Connect your Slack webhook URL.
   - Click "Test Alert" to demonstrate live message delivery to your Slack channel.
   - Schedule 3 emails with `Hourly Limit = 1`.
   - Show the 1st email sends immediately (`SENT`), and the 2nd & 3rd emails get status `RATE_LIMITED_RESCHEDULED`.
   - Show the Slack notification alerting that the sender reached their quota.
6. **Elasticsearch Full-Text Search**:
   - Type a keyword or recipient in the search bar. Show instant results filtered via Elasticsearch.
7. **BullMQ Live Queue Monitor**:
   - Open `http://localhost:5000/admin/queues` to show live BullMQ queues, active workers, and delayed jobs.

---

## 📁 Repository Structure

```
project_new/
├── docker-compose.yml              # PostgreSQL, Redis, Elasticsearch orchestration
├── sample_leads.csv                # Sample leads CSV for testing & video demo
├── README.md                       # Comprehensive documentation
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts               # Prisma PostgreSQL client
│   │   │   ├── redis.ts            # Redis connection for BullMQ & Rate Limiting
│   │   │   └── elastic.ts          # Elasticsearch 8.11 client & index setup
│   │   ├── controllers/
│   │   │   ├── authController.ts   # Google OAuth & profile management
│   │   │   ├── emailController.ts  # Schedule, list, search, cancel emails
│   │   │   └── slackController.ts  # Slack OAuth, webhook, status & alerts
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── emailRoutes.ts
│   │   │   ├── slackRoutes.ts
│   │   │   └── dashboardRoute.ts   # Bull-board live dashboard router
│   │   ├── services/
│   │   │   ├── etherealService.ts  # Multi-sender Ethereal SMTP sender
│   │   │   ├── queueService.ts     # BullMQ delayed job scheduler (No cron)
│   │   │   ├── rateLimitService.ts # Redis atomic hourly rate limiter
│   │   │   ├── slackService.ts     # Slack notifications & OAuth token storage
│   │   │   └── elasticService.ts   # Elasticsearch indexer & search with DB fallback
│   │   ├── workers/
│   │   │   └── emailWorker.ts      # BullMQ worker with concurrency, delay & rate limits
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces
│   │   ├── app.ts                  # Express app middleware & routes
│   │   └── index.ts                # Server bootstrapper & graceful shutdown
│   ├── prisma/
│   │   └── schema.prisma           # Prisma schema (User, EmailJob, SlackIntegration)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.tsx          # Top nav with user profile, Slack badge, BullMQ link
    │   │   ├── StatsBar.tsx        # Live metrics summary
    │   │   ├── Tabs.tsx            # Scheduled & Sent tabs + Compose CTA
    │   │   ├── SearchBar.tsx       # Elasticsearch search input
    │   │   ├── ScheduledTable.tsx  # Scheduled emails table with cancel actions
    │   │   ├── SentTable.tsx       # Sent emails table with Ethereal preview links
    │   │   ├── ComposeModal.tsx    # Email composer, CSV lead parser & rate limit settings
    │   │   ├── SlackModal.tsx      # Slack OAuth & Webhook connection modal
    │   │   └── LoginModal.tsx      # Google OAuth login modal
    │   ├── context/
    │   │   └── AuthContext.tsx     # Google authentication context
    │   ├── services/
    │   │   └── api.ts              # Axios API client
    │   ├── types/
    │   │   └── index.ts            # Frontend TypeScript types
    │   ├── App.tsx                 # Main application layout & state
    │   ├── main.tsx                # React entrypoint
    │   └── index.css               # Tailwind CSS directives
    ├── .env.example
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    └── vite.config.ts
```

---

## 👥 Collaborators & Submission

- **Repository**: Private GitHub repository
- **Access Granted To**:
  - `Mitrajit`
  - `Yadav036`
- **Submission Form**: [Fill ClickUp Submission Form](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
