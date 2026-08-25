# Whatsapp Wiz

Multi-tenant WhatsApp Business API (WABA) platform built with NestJS + Prisma + MySQL (Docker) and a Next.js frontend.

It runs in **Demo/Mock mode** — no Meta/WhatsApp credentials needed. The backend simulates Meta webhooks, template approval, message delivery/read receipts, and a real campaign scheduler, so the entire product works end-to-end out of the box.

## Architecture

```
whatsapp-wiz/
├── backend/     NestJS 10 + Prisma 6 + MySQL 8 (Docker)  — REST API on :4000, Swagger at /api/docs
├── frontend/    Next.js 14 + Tailwind + socket.io + recharts — web app on :3000
└── docker-compose.yml   MySQL 8.4 (container: whatsappwiz-mysql, port 3306)
```

Key design points:

- **Mock WhatsApp engine** (`backend/src/messages/`): outbound messages get real `sent → delivered → read` progression via timers; `POST /api/v1/webhooks/meta/simulate-incoming` lets you simulate a customer replying.
- **In-process queue**: campaign scheduler (`CampaignSchedulerService`) ticks every 2s — no Redis required.
- **Wallet-first**: every outbound message debits the org wallet (template 0.30, text 0.10, media 0.20). Campaigns pause if the wallet runs dry.
- **Realtime**: Socket.IO gateway emits `message:new`, `message:status`, `conversation:updated`, `campaign:updated`, `template:status` to org rooms.
- **RBAC**: roles `super_admin`, `org_admin`, `supervisor`, `agent`, `reseller`; JWT + optional `X-Api-Key` auth for the developer API.
- **Bot builder**: visual flow editor (start/message/question/button/delay/api/handover/end nodes) that auto-replies to incoming messages when published.

## Prerequisites

- Docker Desktop (running)
- Node.js 18+

## Quick start

```bash
# 1. Start MySQL
docker compose up -d

# 2. Install + migrate + seed the backend
npm run setup:backend          # npm i + prisma migrate deploy + seed

# 3. Start backend
npm run dev:backend            # http://localhost:4000/api/v1 (Swagger: /api/docs)

# 4. Frontend (separate terminal)
npm run setup:frontend
npm run dev:frontend           # http://localhost:3000
```

### Demo accounts

| Role       | Email                   | Password       |
|------------|-------------------------|----------------|
| Super admin| `admin@whatsappwiz.io`  | `Admin@123`    |
| Org admin  | `admin@demo.com`        | `Admin@123`    |
| Supervisor | `supervisor@demo.com`   | `Supervisor@123` |
| Agent      | `agent@demo.com`        | `Agent@123`    |
| Reseller   | `reseller@demo.com`     | `Reseller@123` |

## Try it

1. Log in as `admin@demo.com`.
2. **Inbox** → open a conversation, send a message, then call
   `POST /api/v1/webhooks/meta/simulate-incoming` with
   `{"organizationId": 2, "from": "919111111111", "text": "hello"}` to simulate a reply.
3. **Chatbot** → create a flow, add message/question nodes, connect them, **Publish**, then simulate an incoming message on a fresh number — the bot auto-replies.
4. **Campaigns** → create a campaign from an approved template, start it, watch the scheduler deliver and the analytics fill in.
5. **Templates** → create a draft, submit for approval; it auto-approves in ~5s.

## Backend scripts

```bash
cd backend
npm run build            # nest build
npm run start:dev        # watch mode
npm run db:setup         # migrate deploy + seed
npm run prisma:seed      # re-run seed only
```

## Environment

- Backend config: `backend/.env` (DATABASE_URL, JWT secrets, message costs, webhook verify token).
- Frontend API URL: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000`).
