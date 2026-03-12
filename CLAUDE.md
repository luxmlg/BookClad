# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoverCraft is an AI-powered ebook cover generator for Amazon KDP. Users describe their book, select genre/mood/style, and the app generates KDP-compliant cover images (1600x2560px). It has a canvas editor for typography, inpainting (region editing), and export.

## Architecture

This is a **two-process** system:

1. **Next.js app** (`src/`) — Next.js 16 with App Router, React 19, Auth.js v5, Prisma 7 (with `@prisma/adapter-pg`), Tailwind CSS 4. Handles UI, API routes, and enqueues jobs via BullMQ.
2. **Worker** (`worker/`) — Standalone Node/Express process that consumes BullMQ jobs from Redis. Calls AI APIs (OpenAI, Gemini, Ideogram), upscales via Replicate, crops to KDP dimensions with Sharp, and uploads results to R2/S3.

The two processes share the same Postgres database and Redis instance but are **separate packages** with independent `node_modules` and `tsconfig.json`. The worker is excluded from the root `tsconfig.json`.

### Key data flow

1. User creates a `CoverProject` via the wizard (`/create`)
2. User triggers generation from the editor (`/editor/[id]`) → `POST /api/generations` → BullMQ job queued
3. Worker picks up job → generates images via AI → upscales → crops to KDP → uploads to storage → writes `GeneratedImage` rows
4. Editor polls `GET /api/generations/[id]` until status is `COMPLETED`
5. User edits on canvas (Konva/react-konva), can inpaint regions, add typography
6. Export via `POST /api/projects/[id]/export`

### Path aliases

- `@/*` maps to `./src/*` (root app only)
- Worker uses relative imports with `.js` extensions (ESM-style)

## Commands

### Development (run both in parallel)
```
npm run dev           # Next.js dev server (port 3000)
npm run dev:worker    # Worker with tsx watch (port 4000)
```

### Infrastructure
```
docker compose up -d postgres redis   # Start Postgres (port 5433) and Redis (port 6379)
```

### Database
```
npx prisma migrate dev    # Run migrations
npx prisma generate       # Regenerate Prisma client (outputs to src/generated/prisma)
```
The worker has its own Prisma client generated into `worker/src/generated/prisma`. After schema changes, regenerate both:
```
npx prisma generate
cd worker && npx prisma generate
```

### Build & Lint
```
npm run build    # Next.js production build
npm run lint     # ESLint (flat config)
```

## Important Conventions

- **Prisma client import**: Use `import { PrismaClient } from "@/generated/prisma/client"` (not `@prisma/client`) — the client is generated to a custom output path.
- **Validation**: All API request bodies are validated with Zod schemas from `src/lib/validations.ts`. Schemas derive allowed values from `src/lib/constants.ts`.
- **Auth pattern**: API routes check `const session = await auth()` from `src/lib/auth.ts`, then verify `session?.user?.id`. Protected pages redirect via middleware in `src/proxy.ts`.
- **BullMQ queue name**: `"cover-generation"` — used by both the Next.js API (producer) and the worker (consumer). Job names: `"generate"`, `"generate-from-reference"`, `"inpaint"`.
- **Storage**: Images go to Cloudflare R2 (S3-compatible). Dev can use local `uploads/` directory.
- **UI components**: shadcn/ui in `src/components/ui/`. The canvas editor uses Konva via `react-konva` (dynamically imported to avoid SSR).
- **AI models**: OpenAI (gpt-image-1), Gemini 2.0 Flash, Ideogram V3 — dispatched by `model` field on Generation records.
- **KDP constants**: Defined in `src/lib/constants.ts` as `KDP` object (1600x2560, 300 DPI, JPEG).
