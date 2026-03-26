# BookClad Infrastructure & Deployment

> **Last updated:** 2026-03-26
>
> This document describes how BookClad is deployed, the full network topology,
> and every environment variable. It is the single source of truth for
> infrastructure decisions. For code-level architecture (attribute system,
> canvas editor, generation pipeline, credit logic), see `CLAUDE.md`.

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Railway Setup](#2-railway-setup)
- [3. Domain & DNS](#3-domain--dns)
- [4. Cloudflare Configuration](#4-cloudflare-configuration)
- [5. Storage (Cloudflare R2)](#5-storage-cloudflare-r2)
- [6. Authentication](#6-authentication)
- [7. Payments (DodoPayments)](#7-payments-dodopayments)
- [8. WebSocket Architecture](#8-websocket-architecture)
- [9. Environment Variables](#9-environment-variables)
- [10. Local Development vs Deployed](#10-local-development-vs-deployed)
- [11. Production Checklist](#11-production-checklist)
- [12. Keeping This Document Current](#12-keeping-this-document-current)

---

## 1. System Overview

BookClad is a two-process Node.js application deployed on Railway, with Cloudflare handling DNS, CDN, TLS termination, and access control. The Next.js app serves the UI and API routes; the Worker process consumes BullMQ jobs from Redis, generates images via Gemini AI, and pushes real-time progress to browsers over WebSocket. Both processes share a Postgres database and Redis instance via Railway's private network. Generated images are stored in Cloudflare R2 (S3-compatible).

```
                              BROWSER
                            /        \
                           /          \
                 HTTPS (proxied)    WSS (DNS only)
                         |               |
                         v               |
              +--------------------+     |
              |    CLOUDFLARE      |     |
              |  DNS + CDN + TLS   |     |
              |  Zero Trust Access |     |
              |  (dev only)        |     |
              +---------+----------+     |
                        |                |
                        v                v
              +------------------+  +------------------+
              |  BookClad        |  |  Worker          |
              |  (Next.js)       |  |  (Express + WS)  |
              |  Railway service |  |  Railway service  |
              +--------+---------+  +--+----------+----+
                       |               |          |
                       +-------+-------+          |
                               |                  |
                               v                  v
              +------------------+    +-------------------+
              |  Postgres        |    |  Cloudflare R2    |
              |  (Railway)       |    |  (S3-compatible)  |
              |  *.railway       |    |  book-clad-dev    |
              |   .internal      |    +-------------------+
              +------------------+
              +------------------+    +-------------------+
              |  Redis           |    |  External APIs    |
              |  (Railway)       |    |  - Gemini AI      |
              |  *.railway       |    |  - DodoPayments   |
              |   .internal      |    |  - Replicate      |
              +------------------+    +-------------------+
```

**Key points:**
- `dev.bookclad.com` traffic goes through Cloudflare's proxy (orange cloud) — CDN caching, WAF, Zero Trust Access gate.
- `ws-dev.bookclad.com` bypasses Cloudflare's proxy (grey cloud, DNS only) — Railway handles TLS directly. This is required because Cloudflare's proxy + Zero Trust cannot handle WebSocket upgrade requests.
- Postgres and Redis are only accessible via Railway's private network (`*.railway.internal`), never exposed publicly.

---

## 2. Railway Setup

### 2.1 Project Structure

| Item | Value |
|------|-------|
| Project | BookClad |
| Environments | `dev` (prod TBD) |
| Services | BookClad, Worker, Postgres, Redis |
| Networking | Private networking enabled (`*.railway.internal`) |

One Railway project contains all four services. When prod is needed, a second environment will be created in the same project.

### 2.2 BookClad Service (Next.js)

| Item | Value |
|------|-------|
| Root directory | `/` (repo root) |
| Build command | `npm install` (triggers `postinstall` → `prisma generate`) then `next build` |
| Start command | `prisma migrate deploy && next start` |
| Public domain | `dev.bookclad.com` |
| Railway URL | `bookclad-dev.up.railway.app` |

**Why migrations at startup:** Railway's private networking (`*.railway.internal`) is only available at runtime, not during the build phase. The internal Postgres URL can't be reached at build time, so `prisma migrate deploy` runs as part of the start command.

**Prisma client generation:** Runs automatically via the `postinstall` hook in `package.json` (`prisma generate`). The client outputs to `src/generated/prisma`.

### 2.3 Worker Service

| Item | Value |
|------|-------|
| Root directory | `/worker` |
| Build command | `npx prisma generate && tsc` |
| Start command | `node dist/index.js` |
| Public domain | `ws-dev.bookclad.com` |
| Railway URL | `worker-dev-ee1e.up.railway.app` |
| Port | `8080` (Railway sets `PORT=8080`; locally defaults to `4000`) |

**Dockerfile** (`worker/Dockerfile`):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

**Runtime configuration:**
- BullMQ concurrency: 2 (two parallel jobs)
- Stalled job check: every 30 seconds, max 2 stalls before job is marked failed
- Retry backoff delays: 10s → 30s → 60s → 90s → 120s (cap)
- Health endpoint: `GET /health` → `{ status: "ok", queue: "cover-generation" }`
- WebSocket: `/ws/progress`

**Startup tasks:**
1. Start Express + WebSocket server on `PORT`
2. Start BullMQ worker consuming from `cover-generation` queue
3. Sweep stale generations (QUEUED/PROCESSING > 30 min, RETRYING > 120 min → FAILED + refund)
4. Start credit expiry sweep (runs periodically)

### 2.4 Postgres (Railway Managed)

| Item | Value |
|------|-------|
| Image | PostgreSQL 16 |
| Access | Private networking only (`*.railway.internal`) |
| Connection | Injected via `DATABASE_URL` env var |

Not accessible publicly. Both BookClad and Worker connect via the internal URL.

### 2.5 Redis (Railway Managed)

| Item | Value |
|------|-------|
| Image | Redis 7 |
| Access | Private networking only (`*.railway.internal`) |
| Connection | Injected via `REDIS_URL` env var |

Used for BullMQ job queue and Redis pub/sub (WebSocket event relay). The `REDIS_URL` must be parsed to extract `host`, `port`, `username`, and `password` — don't use only host/port.

---

## 3. Domain & DNS

### 3.1 Domain Registration

`bookclad.com` is registered on **Cloudflare** (at-cost pricing, ~$10.44/year, no renewal markup). DNS, CDN, and security are all managed from the same Cloudflare dashboard.

### 3.2 Dev Environment DNS Records

| Type | Name | Target | Proxy Status | Notes |
|------|------|--------|--------------|-------|
| CNAME | `dev` | `gqbhv6t9.up.railway.app` | Proxied (orange cloud) | Next.js app |
| CNAME | `ws-dev` | `hkrpvog0.up.railway.app` | DNS only (grey cloud) | Worker WebSocket |
| TXT | `_railway-verify.dev` | `railway-verify=a3b0fa9eac...` | DNS only | Railway domain verification |
| TXT | `_railway-verify.ws-dev` | `railway-verify=7bf73eb65...` | DNS only | Railway domain verification |

**Important:** The CNAME targets are Railway-assigned hostnames (e.g. `gqbhv6t9.up.railway.app`), NOT the service's public URL (`bookclad-dev.up.railway.app`). These were set up via Railway's **one-click Cloudflare DNS setup** — when adding a custom domain in Railway, it detects Cloudflare and auto-configures the DNS records.

### 3.3 Prod Environment DNS (TBD)

When ready for production:

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `@` (root) | (Railway-assigned) | Proxied |
| CNAME | `ws` | (Railway-assigned) | DNS only |

---

## 4. Cloudflare Configuration

### 4.1 SSL/TLS

**Mode: Full (Strict)**

Cloudflare terminates TLS at the edge and re-encrypts to Railway's origin servers using valid certificates. This ensures end-to-end encryption.

### 4.2 Zero Trust Access (Dev Environment)

| Setting | Value |
|---------|-------|
| Application name | BookClad Dev |
| Protected hostnames | `dev.bookclad.com` only |
| Session duration | 1 week |
| Login method | One-time PIN (emailed) |
| Policy | "Only me" — Allow — Emails: owner's email |

Anyone visiting `dev.bookclad.com` sees a Cloudflare login screen. Only the owner's email is allowed through.

**Why `ws-dev.bookclad.com` is NOT in the Access application:**
- Cloudflare Access intercepts HTTP requests and injects a login flow
- The browser's WebSocket client (`new WebSocket(...)`) cannot handle Cloudflare's login redirect
- The callback path (`/cdn-cgi/access/authorized`) doesn't exist on the Worker's Express server
- The WebSocket endpoint only serves real-time progress data (not sensitive) and requires knowing specific generation IDs

### 4.3 CDN

Cloudflare caches static assets from the Next.js app (JS, CSS, images). API routes and dynamic pages pass through without caching.

---

## 5. Storage (Cloudflare R2)

| Environment | Bucket | Status |
|-------------|--------|--------|
| Dev | `book-clad-dev` | Active |
| Prod | TBD | Not yet created |

R2 is S3-compatible. Both the app and worker use `@aws-sdk/client-s3` to interact with it.

**Dev fallback:** When `R2_ENDPOINT` is not set (local development), both app and worker fall back to the local `uploads/` directory. Files are served via the `/api/uploads/` route.

**Stored content:**
- Generated cover images (`covers/{projectId}/{uuid}.jpg`)
- User-uploaded assets
- Custom fonts
- Exported covers

**Signed URLs:** Download URLs are pre-signed with a 1-hour expiration via `@aws-sdk/s3-request-presigner`.

---

## 6. Authentication

| Item | Value |
|------|-------|
| Framework | Auth.js v5 (`next-auth@5.0.0-beta.30`) |
| Session strategy | Database (Prisma adapter), not JWT |
| Sign-in page | `/sign-in` |

### OAuth Providers

| Provider | Status | Notes |
|----------|--------|-------|
| Google | Active | `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` |
| Amazon | Active | `AUTH_AMAZON_ID` + `AUTH_AMAZON_SECRET` (custom OAuth config) |
| Apple | Conditional | Only shown if `AUTH_APPLE_ID` + `AUTH_APPLE_SECRET` are set |

All providers use `allowDangerousEmailAccountLinking: true` (safe because all providers verify emails).

### OAuth Callback URLs

When the domain changes, update callback URLs in each provider's developer console:

| Provider | Dev Callback URL |
|----------|-----------------|
| Google | `https://dev.bookclad.com/api/auth/callback/google` |
| Amazon | `https://dev.bookclad.com/api/auth/callback/amazon` |
| Apple | `https://dev.bookclad.com/api/auth/callback/apple` |

Google also requires `https://dev.bookclad.com` in **Authorized JavaScript Origins** (no path).

**Critical:** `AUTH_URL` must match the deployed domain. If it's wrong, OAuth callbacks will fail.

---

## 7. Payments (DodoPayments)

| Setting | Dev Value |
|---------|-----------|
| Environment | `test_mode` |
| Webhook URL | `https://dev.bookclad.com/api/webhooks/dodo` |
| SDK | `dodopayments` npm package |

**Webhook authentication:** Signature verification via `dodo.webhooks.unwrap()`. The webhook endpoint does NOT use `auth()` — it's called by DodoPayments servers. Raw body is read with `request.text()` before JSON parsing for signature verification to work.

**Idempotency:** `WebhookEvent` model with `webhook-id` as primary key ensures exactly-once processing.

**Products:**
- Subscription tiers: Starter, Pro, Studio (product IDs in env vars)
- Credit packs: 50, 100, 250, 500 credits (product IDs in env vars)

**Local testing:** Use `test_mode`, create test products in Dodo dashboard, use ngrok pointing to port 3000 with webhook URL `https://<ngrok>/api/webhooks/dodo`.

---

## 8. WebSocket Architecture

The Worker bridges Redis pub/sub to WebSocket for real-time generation progress:

```
  Worker Processor                           Browser
  (BullMQ job handler)                       (WebSocket client)
         |                                        |
         | publishProgress()                      | new WebSocket(
         |                                        |   "wss://ws-dev.bookclad.com
         v                                        |    /ws/progress")
  +--------------+                                v
  |    Redis     |  <--- subscribe ---  +------------------+
  |   PUBLISH    |  ---- message ---->  |  Worker          |
  |              |                      |  WebSocket       |
  |  Channels:   |                      |  Server (ws lib) |
  |  generation:{id}                    +--------+---------+
  |  project:{projectId}                         |
  +--------------+                               | ws.send(JSON)
                                                 v
                                              Browser
```

| Setting | Dev Value |
|---------|-----------|
| WebSocket URL | `wss://ws-dev.bookclad.com/ws/progress` |
| Env var | `NEXT_PUBLIC_WS_URL` |
| Server | Worker's Express + `ws` library |
| CORS origin | `APP_URL` env var on Worker |

**Subscription channels:**
- `generation:{id}` — granular progress for a single generation (used in editor)
- `project:{projectId}` — status transitions for all project generations (used on dashboard)

**Reliability:** No polling fallback. The client does a one-shot HTTP fetch on mount and on WebSocket reconnect to catch any events missed during disconnection.

**Auto-reconnect:** Exponential backoff from 1s to 10s max.

---

## 9. Environment Variables

### 9.1 BookClad Service (Next.js)

**Database & Cache:**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string |

**Authentication:**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `AUTH_SECRET` | Yes (prod) | — | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Yes | — | Set `"true"` for Railway |
| `AUTH_URL` | Yes (prod) | — | `https://dev.bookclad.com` |
| `AUTH_GOOGLE_ID` | Yes (prod) | — | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes (prod) | — | Google OAuth client secret |
| `AUTH_AMAZON_ID` | No | — | Amazon OAuth (conditionally shown) |
| `AUTH_AMAZON_SECRET` | No | — | Amazon OAuth (conditionally shown) |
| `AUTH_APPLE_ID` | No | — | Apple OAuth (conditionally shown) |
| `AUTH_APPLE_SECRET` | No | — | Apple OAuth (conditionally shown) |
| `AUTH_GITHUB_ID` | No | — | GitHub OAuth (not currently active) |
| `AUTH_GITHUB_SECRET` | No | — | GitHub OAuth (not currently active) |

**AI & Image Generation:**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key |
| `REPLICATE_API_TOKEN` | No | — | Upscaling; falls back to Sharp |

**Storage (Cloudflare R2):**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `R2_ENDPOINT` | No | — | Unset = local filesystem fallback |
| `R2_BUCKET` | No | `covergen` | S3 bucket name |
| `R2_ACCESS_KEY_ID` | No | — | Required if `R2_ENDPOINT` is set |
| `R2_SECRET_ACCESS_KEY` | No | — | Required if `R2_ENDPOINT` is set |

**Payments (DodoPayments):**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DODO_PAYMENTS_API_KEY` | No | — | API bearer token |
| `DODO_PAYMENTS_WEBHOOK_KEY` | No | — | Webhook signature key |
| `DODO_PAYMENTS_ENVIRONMENT` | No | `test_mode` | `test_mode` or `live_mode` |
| `DODO_PRODUCT_ID_STARTER` | No | — | Starter subscription product |
| `DODO_PRODUCT_ID_PRO` | No | — | Pro subscription product |
| `DODO_PRODUCT_ID_STUDIO` | No | — | Studio subscription product |
| `DODO_PRODUCT_ID_CREDITS_50` | No | — | 50 credit pack product |
| `DODO_PRODUCT_ID_CREDITS_100` | No | — | 100 credit pack product |
| `DODO_PRODUCT_ID_CREDITS_250` | No | — | 250 credit pack product |
| `DODO_PRODUCT_ID_CREDITS_500` | No | — | 500 credit pack product |

**Application URLs:**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:4000/ws/progress` | WebSocket endpoint |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Used for checkout return URLs |

**Feedback:**

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GITHUB_FEEDBACK_TOKEN` | No | — | PAT with `issues:write` scope |
| `GITHUB_FEEDBACK_REPO` | No | `luxmlg/BookClad` | Repo for feedback issues |

### 9.2 Worker Service

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `4000` | Railway sets `8080` automatically |
| `DATABASE_URL` | Yes | — | Same Postgres as BookClad |
| `REDIS_URL` | No | `redis://localhost:6379` | Same Redis as BookClad |
| `APP_URL` | No | `http://localhost:3000` | CORS origin for WebSocket |
| `GEMINI_API_KEY` | Yes | — | Image generation |
| `REPLICATE_API_TOKEN` | No | — | Upscaling; falls back to Sharp |
| `R2_ENDPOINT` | No | — | Unset = local filesystem |
| `R2_BUCKET` | No | `covergen` | S3 bucket name |
| `R2_ACCESS_KEY_ID` | No | — | Required if `R2_ENDPOINT` is set |
| `R2_SECRET_ACCESS_KEY` | No | — | Required if `R2_ENDPOINT` is set |
| `UPLOADS_DIR` | No | `../uploads` | Local storage path (dev/Docker) |
| `NODE_ENV` | No | — | Controls error stack trace logging |

### 9.3 Variables Shared Between Services

These must have identical values on both BookClad and Worker:

- `DATABASE_URL` — same Postgres instance
- `REDIS_URL` — same Redis instance
- `GEMINI_API_KEY` — same API key
- `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — same R2 bucket

### 9.4 Railway-Injected Variables

Railway automatically sets these:

- `PORT` — set to `8080` on Railway (Worker uses this for its Express server)
- `DATABASE_URL` — injected from the Postgres service when linked
- `REDIS_URL` — injected from the Redis service when linked

---

## 10. Local Development vs Deployed

| Concern | Local | Railway Dev |
|---------|-------|-------------|
| **Database** | Docker `postgres:16-alpine` on port 5433 | Railway managed, private networking |
| **Redis** | Docker `redis:7-alpine` on port 6379 | Railway managed, private networking |
| **Storage** | Local `uploads/` directory | Cloudflare R2 bucket `book-clad-dev` |
| **WS URL** | `ws://localhost:4000/ws/progress` | `wss://ws-dev.bookclad.com/ws/progress` |
| **App URL** | `http://localhost:3000` | `https://dev.bookclad.com` |
| **Payments** | `test_mode` + ngrok for webhooks | `test_mode`, webhook at `dev.bookclad.com` |
| **Auth callbacks** | `http://localhost:3000/api/auth/callback/*` | `https://dev.bookclad.com/api/auth/callback/*` |
| **Worker port** | 4000 | 8080 (Railway `PORT`) |
| **Next.js** | `npm run dev` (hot reload, port 3000) | `prisma migrate deploy && next start` |
| **Worker** | `npm run dev:worker` (tsx watch) | `node dist/index.js` |
| **Infra start** | `docker compose up -d postgres redis` | Always running |

---

## 11. Production Checklist

When ready to go live, complete these items:

- [ ] Create prod environment in Railway project
- [ ] Configure DNS: `bookclad.com` (CNAME, proxied) → Railway prod Next.js
- [ ] Configure DNS: `ws.bookclad.com` (CNAME, DNS only) → Railway prod Worker
- [ ] Create prod R2 bucket (separate from `book-clad-dev`)
- [ ] Set all env vars on prod services (see [Section 9](#9-environment-variables))
- [ ] Set `AUTH_URL=https://bookclad.com`
- [ ] Set `NEXT_PUBLIC_APP_URL=https://bookclad.com`
- [ ] Set `NEXT_PUBLIC_WS_URL=wss://ws.bookclad.com/ws/progress`
- [ ] Set `DODO_PAYMENTS_ENVIRONMENT=live_mode`
- [ ] Create live products in DodoPayments dashboard and set product ID env vars
- [ ] Set DodoPayments webhook URL to `https://bookclad.com/api/webhooks/dodo`
- [ ] Add OAuth callback URLs in Google/Amazon/Apple consoles for `bookclad.com`
- [ ] Add `https://bookclad.com` to Google Authorized JavaScript Origins
- [ ] Decide Cloudflare Access for prod (remove Zero Trust if public, or keep for staging)
- [ ] Verify `bookclad.com` loads and OAuth sign-in works
- [ ] Verify WebSocket connection at `wss://ws.bookclad.com/ws/progress`
- [ ] Verify webhook events are received from DodoPayments
- [ ] Test a full generation cycle (create project → generate → download)

---

## 12. Keeping This Document Current

Update this document when:

- DNS records are added or changed
- Cloudflare settings are modified (SSL, Access policies, CDN rules)
- Railway services are added, removed, or reconfigured
- New environment variables are introduced (keep in sync with `.env.example`)
- External service integrations change (new providers, API migrations)
- A production environment is created (update Section 11 checklist)
