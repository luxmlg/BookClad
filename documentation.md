# AI Kindle Cover Generator — Product Requirements Document

**Version:** 2.0  
**Status:** Draft  
**Last Updated:** March 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Target Users](#2-target-users)
3. [KDP Technical Specifications (Non-Negotiable)](#3-kdp-technical-specifications-non-negotiable)
4. [Tech Stack & Architecture](#4-tech-stack--architecture)
5. [Core Features (MVP)](#5-core-features-mvp)
6. [Image Generation Pipeline](#6-image-generation-pipeline)
7. [Canvas Editor](#7-canvas-editor)
8. [KDP Compliance Checker](#8-kdp-compliance-checker)
9. [Export](#9-export)
10. [Extended Features (Post-MVP)](#10-extended-features-post-mvp)
11. [AI Prompt (System Prompt Spec)](#11-ai-prompt-system-prompt-spec)
12. [Prisma Schema](#12-prisma-schema)
13. [Docker Compose](#13-docker-compose)
14. [Cost Model](#14-cost-model)
15. [Monetization Model](#15-monetization-model)
16. [What Authors Are Asking For (Validated Needs)](#16-what-authors-are-asking-for-validated-needs)
17. [Competitive Landscape](#17-competitive-landscape)
18. [Resolved Decisions](#18-resolved-decisions)

---

## 1. Product Overview

An AI-powered web application that generates KDP-compliant Kindle ebook covers from natural language prompts. Designed for indie authors and self-publishers who need professional covers fast — without hiring a designer or learning complex tools.

### Problem Statement

Self-publishing authors face a painful gap: cover design is one of the most critical factors in book sales, yet it requires either expensive designers ($200–$1,500+) or technical skill with tools like Photoshop or Illustrator. Existing AI tools either produce raw images that fail KDP's technical requirements (wrong resolution, no safe zones, no typography), or are generic design platforms not built for book publishing workflows.

### Value Proposition

- **KDP-ready output** — always technically compliant (correct dimensions, RGB, safe zones), no rejections
- **Genre-aware AI** — understands thriller vs. romance vs. fantasy visual languages
- **No design skills required** — guided brief, not raw prompt engineering
- **Minutes, not days** — from brief to downloadable cover in under 60 seconds (after generation completes)

---

## 2. Target Users

| User Type                   | Description                                   | Pain Point                                                  |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| **Indie Author (Primary)**   | Self-publishing on KDP, budget-conscious       | Can't afford designers; current tools are generic           |
| **Prolific Series Author**  | Publishes 4–12+ books/year                    | Needs visual consistency across titles at scale              |
| **First-Time Publisher**    | Just finished their first manuscript          | Overwhelmed by technical requirements and design basics     |
| **Content/Niche Publisher** | Publishes informational or lead-magnet ebooks | Needs fast, professional output without storytelling polish |

---

## 3. KDP Technical Specifications (Non-Negotiable)

All generated covers **must** conform to Amazon KDP's published requirements. These are hard constraints, not suggestions.

### eBook (Kindle) Cover

| Property                | Requirement                                  |
| ----------------------- | -------------------------------------------- |
| **Ideal dimensions**    | 2,560 px (H) × 1,600 px (W)                  |
| **Minimum dimensions**  | 1,000 px on longest side; 625 px on shortest |
| **Aspect ratio**        | 1.6:1 (height:width)                         |
| **File format**         | JPEG (preferred); TIFF accepted               |
| **Color profile**       | RGB only — CMYK is not supported              |
| **Resolution**          | 300 DPI minimum recommended                   |
| **Max file size**       | 50 MB                                         |
| **Max pixel dimension** | 10,000 px on longest side                     |

**Note on DPI:** 300 DPI is metadata written into the JPEG (e.g. via Sharp.js). The real constraint is **pixel dimensions**. The compliance checker validates pixels and file format; DPI is set at export time.

### Additional KDP Rules

- Title and Author name must be legible (no blurry or pixelated text)
- Cover content must not infringe third-party copyrights
- No pricing or promotional text on internal cover
- White/very light backgrounds should include a narrow medium-gray border (3–4 px)
- AI-generated artwork is currently permitted by Amazon

### Resolution Caveat: AI APIs vs KDP

Amazon's ideal size is **1600 × 2560 px**. Current AI image APIs (e.g. OpenAI gpt-image-1.5) max out at **1024×1536** or **1536×1024**. Delivering KDP-ready output therefore **requires an upscaling step** in the pipeline (see [Image Generation Pipeline](#6-image-generation-pipeline)).

> **Output default:** All exported covers are **1600 × 2560 px, RGB, JPEG, 300 DPI** — matching Amazon's highest recommendation.

---

## 4. Tech Stack & Architecture

### Stack Summary

| Layer           | Technology |
| --------------- | ---------- |
| **Frontend**    | Next.js 16 (App Router), TypeScript, React 19, Tailwind CSS v4, shadcn/ui; Turbopack is the stable default bundler |
| **Canvas editor** | Konva.js (react-konva) — text overlay, image drag/resize, layer management |
| **Typography**  | Google Fonts (free, license-friendly) |
| **API / Auth**  | Next.js API Routes (Route Handlers), NextAuth.js v5 (Auth.js); route protection via `proxy.ts` (Next.js 16 replaces `middleware.ts`) |
| **Long-running jobs** | Express.js worker service, BullMQ, Redis |
| **Database**     | PostgreSQL, Prisma ORM |
| **Image generation** | OpenAI gpt-image-1.5 (generation + inpainting) |
| **Upscaling**    | Real-ESRGAN via Replicate API |
| **Image processing** | Sharp.js (crop, resize, DPI metadata, JPEG export) |
| **Storage**      | Cloudflare R2 or AWS S3 |
| **Infrastructure** | Docker Compose (Next.js app, Express worker, PostgreSQL, Redis) |

### High-Level Architecture

```mermaid
graph TB
    subgraph client [Browser]
        UI[Next.js Frontend]
        Canvas[Konva.js Canvas Editor]
    end

    subgraph nextApp [Next.js App Container]
        Routes[API Routes]
        ServerActions[Server Actions]
        AuthModule[NextAuth.js v5]
    end

    subgraph worker [Express Worker Container]
        JobProcessor[BullMQ Worker]
        ImageGen[OpenAI gpt-image-1.5]
        Upscaler[Real-ESRGAN via Replicate]
        PostProcess[Sharp.js Pipeline]
    end

    subgraph data [Data Layer]
        PG[(PostgreSQL)]
        RedisDB[(Redis)]
        S3[(Cloudflare R2 / S3)]
    end

    UI -->|HTTP / Server Actions| Routes
    UI --> Canvas
    Routes -->|Enqueue job| RedisDB
    Routes -->|Prisma ORM| PG
    JobProcessor -->|Poll jobs| RedisDB
    JobProcessor --> ImageGen
    ImageGen -->|1024x1536 images| Upscaler
    Upscaler -->|2048x3072| PostProcess
    PostProcess -->|1600x2560 JPEG| S3
    JobProcessor -->|Update status| PG
    Routes -->|Signed URLs| S3
```

### Next.js 16 Notes

- **Turbopack** is the stable default bundler (no extra config); faster dev and builds.
- **Route protection:** Next.js 16 uses `proxy.ts` instead of `middleware.ts` for redirects and header modification; use it for lightweight auth checks (e.g. redirect unauthenticated users from `/dashboard`, `/create`, `/editor`). Heavy logic (DB, JWT validation) stays in Route Handlers or Server Components.

### Why Next.js API Routes + Separate Express Worker

- **Next.js API Routes** handle auth, CRUD, user data, compliance checks, and enqueueing jobs. They stay within typical serverless time limits.
- **Express worker** runs as a separate container, consuming jobs from Redis (BullMQ). Image generation (5–15s) + upscaling (2–5s) + post-processing can take 10–30s total — too long for a single HTTP request. Async processing with a job queue is required.

---

## 5. Core Features (MVP)

The MVP flow: **sign up / sign in → guided brief (wizard) → async image generation → select variation → canvas edit (text + optional region edit) → compliance check → export**. Target: from brief to downloadable cover in under 60 seconds of user time after generation completes.

### 5.1 Authentication & User Management

- **NextAuth.js v5** with email/password and OAuth (Google, GitHub).
- User accounts are required for:
  - Tracking generation usage per tier (free vs paid)
  - Storing projects and cover history
  - Enforcing limits (e.g. 3 generations/month on free tier)

### 5.2 Guided Brief (Wizard-Style Flow)

Replace a single long form with a **multi-step wizard**:

| Step | Name           | Inputs |
| ---- | -------------- | ------ |
| 1    | Book info      | Book title, author name, optional subtitle |
| 2    | Genre & mood   | Genre (visual picker with example thumbnails), mood tags (multi-select) |
| 3    | Style          | Art style: photorealistic, illustrated, painterly, minimalist, typographic (with visual examples) |
| 4    | Details (opt.) | Additional keywords, optional reference image upload (see Extended Features) |
| 5    | Generate       | Submit brief; show progress; display 2–4 variations in a grid |

**Output:** 2–4 cover image variations (background/art only; no title/author text). User selects one to proceed to the canvas editor.

### 5.3 AI Cover Generation (Async)

- User submits the brief; API enqueues a **BullMQ** job and returns a job ID (202 Accepted).
- Frontend polls job status (or uses SSE) until completion.
- Worker: build prompt from brief → call OpenAI gpt-image-1.5 (4 images at 1024×1536) → upscale each via Replicate (Real-ESRGAN) → crop/resize to 1600×2560 with Sharp → upload to R2/S3 → mark job complete with image URLs.
- Each image is KDP-sized and ready for text overlay in the canvas.

### 5.4 Canvas Editor (Image + Text)

- **Konva.js** canvas: background image + text layers (title, subtitle, author).
- **Split view:** canvas on the left, properties panel on the right.
- **Layer panel:** list of layers (background, title, subtitle, author) for selection and reorder.
- **Text:** content, font (from Google Fonts, genre-grouped), size, weight, color, letter-spacing, drop shadow/outline for legibility.
- **Safe zones:** visible guides so title/author stay within KDP-safe areas.
- **Kindle Store preview:** small thumbnail (~120px wide) approximating Amazon browse size to catch readability issues.

**Region-based editing (MVP scope):** User can select a region (e.g. sky, character), supply a text prompt (e.g. “make the sky more dramatic”), and trigger **one** inpainting request via gpt-image-1.5’s mask API. The rest of the image stays unchanged. Advanced multi-region or multi-step refinement is post-MVP.

### 5.5 KDP Compliance Checker

- Runs before export. See [Section 8](#8-kdp-compliance-checker).

### 5.6 Export

- See [Section 9](#9-export).

---

## 6. Image Generation Pipeline

KDP requires **1600 × 2560 px**. OpenAI gpt-image-1.5 supports up to **1024×1536** (portrait) or **1536×1024** (landscape). An **upscaling pipeline** is mandatory.

### Pipeline Steps

1. **Prompt assembly** — From brief: genre, mood, style, keywords → structured prompt (see [Section 11](#11-ai-prompt-system-prompt-spec)).
2. **Generation** — OpenAI gpt-image-1.5, portrait **1024×1536**, medium quality (cost vs quality balance). Output: 2–4 images (base64 or URLs).
3. **Upscale** — For each image: send to Replicate (Real-ESRGAN), 2× upscale → **2048×3072**.
4. **Crop / resize** — Sharp.js: crop or resize to exactly **1600×2560** (aspect 0.625). 1024:1536 ≈ 0.667, so a small crop or letterbox is applied; no visible distortion if composed with safe zones in mind.
5. **Metadata & format** — Set 300 DPI in JPEG metadata, RGB, quality ~90. Upload to R2/S3; store key in DB and return signed URLs to client.

### Sequence (Conceptual)

```mermaid
sequenceDiagram
    participant U as User
    participant API as Next.js API
    participant Q as BullMQ/Redis
    participant W as Express Worker
    participant OAI as OpenAI API
    participant RE as Replicate API
    participant S as Sharp.js
    participant R2 as Cloudflare R2

    U->>API: Submit brief form
    API->>Q: Enqueue generation job
    API->>U: Return job ID (202 Accepted)
    U->>API: Poll job status (SSE or polling)
    Q->>W: Worker picks up job
    W->>OAI: Generate 4 images (1024x1536, medium quality)
    OAI-->>W: 4 base64 images
    loop For each image
        W->>RE: Upscale 2x (Real-ESRGAN)
        RE-->>W: 2048x3072 image
        W->>S: Crop to 1600x2560, set 300 DPI, JPEG
        S-->>W: Final KDP-ready image
        W->>R2: Upload to storage
    end
    W->>Q: Mark job complete with image URLs
    API->>U: Return signed image URLs
```

### Inpainting (Region Edit)

- User draws a mask on the canvas (e.g. brush tool) and enters a text prompt.
- Frontend sends mask (PNG, transparent = edit area) + prompt + source image to API.
- Worker calls gpt-image-1.5 **image edit** API (mask + image input), then runs the same upscale + crop pipeline on the result.
- One region per request in MVP; result replaces the layer or image in the project.

---

## 7. Canvas Editor

### Technology

- **Konva.js** via `react-konva`: one Stage, one Layer for background image, separate Layers or Groups for each text block. Enables drag, resize, rotate, and serialization of the stage to JSON (saved in `CoverProject.canvasState`).

### Layout & UX

- **Split view:** Main canvas (left) at fixed aspect 1600:2560; properties panel (right) for the selected object (position, font, size, color, effects).
- **Layer panel:** Lists background + text elements; click to select; optional reorder for z-index.
- **Font browser:** Fonts grouped by genre (e.g. Thriller, Romance, Fantasy); live preview on the current cover.
- **Safe zones:** Semi-transparent overlays or guides for “title zone” (upper third) and “author zone” (lower fifth) so users keep text within KDP-safe areas.
- **Kindle Store preview:** A small box showing the cover at ~120px width to simulate Amazon browse; helps catch low legibility.

### Smart Defaults

- **Font suggestions:** Based on project genre (e.g. serif for literary, bold sans-serif for thriller).
- **Text placement:** Default title in upper third, author in lower fifth, matching the AI prompt’s reserved areas.
- **Effects:** Default subtle drop shadow on text to improve readability on varied backgrounds.

### Region Editing (Inpainting) UX

- **Brush tool:** User paints the area to change (mask = painted region).
- **Prompt popover:** “Describe the change” (e.g. “make the sky more dramatic”). Submit → same async job pattern as full generation; on completion, replace the background image with the new result.

---

## 8. KDP Compliance Checker

Automated validation runs before export to catch common KDP rejection reasons.

### Checks

| Check                              | Type | Action if failed |
| ---------------------------------- | -----| ------------------- |
| Canvas dimensions 1600 × 2560      | Hard | Block export (enforced by app) |
| Color profile RGB (not CMYK)       | Hard | Block export |
| DPI set to 300 in export metadata  | Hard | Block export (set at export time) |
| File size under 50 MB              | Hard | Block export |
| Text not clipped or outside safe zones | Hard | Block export; highlight problem areas |
| Minimum contrast ratio on title text   | Hard | Block export or warn with suggestion |
| Near-white background              | Soft | Warn and suggest 3–4 px medium-gray border |

**Contrast:** Compute contrast ratio (e.g. WCAG) between text color and underlying background (sample pixels under text bounding box or use a conservative estimate). Reject or warn if below threshold (e.g. 4.5:1 for normal text).

**Behavior:** Hard failures prevent download until resolved. Soft warnings allow export but are shown clearly so the user can fix them.

---

## 9. Export

- **Primary:** Download as high-res JPEG (1600 × 2560, RGB, 300 DPI) — KDP-ready, no watermarks (per tier).
- **Optional:** PNG export for marketing or social use.
- **Optional — 3D mockup:** Use **CSS 3D transforms** (e.g. `transform-style: preserve-3d`, `perspective`, `rotateY`) to render the cover on a book-shaped frame; export as image (e.g. html2canvas or server-side render) for “book on desk” or “book in hand” style assets for social/promo. No need for a separate 3D engine at MVP.

---

## 10. Extended Features (Post-MVP)

### 10.1 Series Consistency Mode

- User uploads or selects a previous cover (from project history, stored in R2) as style reference.
- gpt-image-1.5 accepts **image inputs** (up to 16) and `inputFidelity`; use reference image(s) so the model maintains color palette, composition style, and visual motifs while generating a new cover with updated title.

### 10.2 Reference Image Upload (Stylistic)

- User uploads an inspiration image (book cover, painting, photo). App sends it as input to gpt-image-1.5 for “match mood/color/composition, do not reproduce” — stylistic guidance only, no copyright reproduction.

### 10.3 Advanced Inpainting / Multi-Region

- Multiple regions per request, or chained inpainting steps (e.g. “change sky” then “change character pose”) with history/undo. Builds on the same mask + edit API.

### 10.4 Genre Prompt Library

- Pre-built prompt templates for top genres (Romance, Thriller, Fantasy, Sci-Fi, Self-Help, Children’s/YA, Horror, Cozy Mystery) with example thumbnails and one-click “generate with this style.”

### 10.5 Batch Generation

- Generate covers for an entire series in one job: same style, sequential titles/numbers. For prolific publishers.

### 10.6 Social Media Export Pack

- Auto-resize and reformat one cover for: Amazon A+ banner, Instagram post/story, Facebook ad, Twitter/X header.

---

## 11. AI Prompt (System Prompt Spec)

The prompt sent to **OpenAI gpt-image-1.5** for each cover should follow this structure (gpt-image-1.5 has strong instruction-following; no need for a separate “system” vs “user” split if the API takes a single prompt):

```
You are a professional book cover designer specializing in [GENRE] covers for Amazon Kindle.

Create a [STYLE] book cover image with the following specifications:
- Canvas: Portrait orientation, 1.6:1 aspect ratio (will be cropped to exact dimensions later)
- Genre conventions: [GENRE-SPECIFIC VISUAL RULES]
- Mood: [MOOD TAGS]
- Key visual elements: [USER KEYWORDS]
- Leave clear, uncluttered space in the upper third for the title text
- Leave clear space in the lower fifth for the author name
- Lighting: [DERIVED FROM MOOD — e.g., dramatic rim lighting, warm golden hour, cold moonlight]
- Color palette: [DERIVED FROM GENRE + MOOD]
- NO text, NO watermarks, NO borders in the generated image

The cover must look competitive on the Amazon bestseller page for [GENRE]. It should
immediately communicate [CORE BOOK THEME] to a browsing reader in thumbnail size.
```

**Genre-specific visual rule examples:**

| Genre                 | Default Visual Rules                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Thriller              | High contrast, desaturated palette, single dominant silhouette or object, dramatic shadow  |
| Romance               | Warm/rose tones, soft focus, figures (if any) in close proximity, bokeh background         |
| Epic Fantasy          | Wide establishing shot, sense of scale, glowing magical elements, deep sky                |
| Self-Help/Non-Fiction | Clean geometric layout, bold typography-friendly negative space, professional palette     |
| Horror                | Low key lighting, desaturated with single accent color (red/sickly green), isolation/dread   |
| Cozy Mystery          | Illustrated style, warm colors, small-town or domestic setting, cat/teacup motif          |

---

## 12. Prisma Schema

Core models for users, projects, generations, and assets:

```prisma
model User {
  id               String         @id @default(cuid())
  email            String         @unique
  name             String?
  passwordHash     String?
  tier             Tier           @default(FREE)
  generationsUsed  Int            @default(0)
  generationsReset DateTime?
  projects         CoverProject[]
  accounts         Account[]
  sessions         Session[]
  createdAt        DateTime       @default(now())
}

enum Tier { FREE STARTER PRO PAY_PER_COVER }

model CoverProject {
  id           String       @id @default(cuid())
  userId       String
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title        String
  author       String
  genre        String
  mood         String[]     // array of mood tags
  style        String       // art style
  brief        String?
  canvasState  Json?        // Serialized Konva.js stage JSON
  generations  Generation[]
  exports      Export[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([userId])
}

model Generation {
  id         String           @id @default(cuid())
  projectId  String
  project    CoverProject     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  prompt     String           // Assembled AI prompt
  status     JobStatus        @default(QUEUED)
  images     GeneratedImage[]
  cost       Float?
  createdAt  DateTime         @default(now())

  @@index([projectId])
  @@index([status])
}

enum JobStatus { QUEUED PROCESSING COMPLETED FAILED }

model GeneratedImage {
  id           String     @id @default(cuid())
  generationId String
  generation   Generation @relation(fields: [generationId], references: [id], onDelete: Cascade)
  storageKey   String     // R2/S3 key
  width        Int
  height       Int
  selected     Boolean    @default(false)

  @@index([generationId])
}

model Export {
  id         String       @id @default(cuid())
  projectId  String
  project    CoverProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  format     String       // "jpeg" | "png"
  storageKey String
  createdAt  DateTime     @default(now())

  @@index([projectId])
}

// NextAuth.js v5 (Auth.js) required models — see https://authjs.dev/reference/adapter/prisma
// model Account { ... }
// model Session { ... }
// model VerificationToken { ... }
```

`Account`, `Session`, and `VerificationToken` should be added per the [NextAuth.js Prisma adapter](https://authjs.dev/reference/adapter/prisma) documentation.

---

## 13. Docker Compose

Orchestrate the app, worker, database, and queue:

```yaml
services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/covergen
      REDIS_URL: redis://redis:6379
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      REPLICATE_API_TOKEN: ${REPLICATE_API_TOKEN}
      R2_BUCKET: ${R2_BUCKET}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
    depends_on:
      - postgres
      - redis

  express:
    build: ./worker
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/covergen
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      REPLICATE_API_TOKEN: ${REPLICATE_API_TOKEN}
      R2_BUCKET: ${R2_BUCKET}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: covergen
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

- **nextjs:** Next.js 16 app (frontend + API routes). Turbopack is the default bundler.
- **express:** Express worker (BullMQ consumer, calls OpenAI + Replicate + Sharp, uploads to R2).
- **postgres:** PostgreSQL 16.
- **redis:** Redis 7 for BullMQ.

---

## 14. Cost Model

### Per-Generation API Costs (Approximate, March 2026)

| Item              | Unit cost      | Per generation (4 images) |
| ----------------- | -------------- | ------------------------- |
| OpenAI gpt-image-1.5 (medium, 1024×1536) | ~$0.04–$0.06/image | ~$0.16–$0.24 |
| Replicate Real-ESRGAN (2× upscale)       | ~$0.002/image  | ~$0.008                    |
| **Total per full generation**           |                | **~$0.17–$0.25**          |
| Inpainting (1 edit)                     | ~$0.04–$0.20/image | ~$0.04–$0.20 per edit |

- **High quality** (e.g. $0.14–$0.20/image): ~$0.56–$0.80 per generation + upscale.
- **Medium quality** (recommended default): ~$0.25 per generation keeps margins viable for paid tiers.

### Implications for Tiers

- **Free:** 3 generations/month → ~$0.75/month cost; monetize via conversion to Starter/Pro.
- **Starter ($9/mo):** e.g. 20 generations → ~$5 API cost; healthy margin.
- **Pro ($19/mo):** “Unlimited” with fair-use policy or high cap; monitor abuse.
- **Pay-per-cover ($2–3):** Covers API cost + margin at 1–2 generations per purchase.

---

## 15. Monetization Model

| Tier              | Price       | Limits                                                                 |
| ----------------- | ----------- | ---------------------------------------------------------------------- |
| **Free**          | $0          | 3 generations/month, low-res watermarked preview (e.g. 800×500), no JPEG export |
| **Starter**       | $9/mo       | 20 generations/month, full-res JPEG download, 3D mockup                |
| **Pro**           | $19/mo      | High cap or unlimited (fair use), series mode, batch export, social pack |
| **Pay-per-cover** | $2–3/cover  | For infrequent users; 1–2 full-resolution exports per purchase          |

Pricing is informed by the [Cost Model](#14-cost-model); margins are viable at medium-quality default generation.

---

## 16. What Authors Are Asking For (Validated Needs)

1. **“Just make it look like a real [genre] book”** — genre awareness is the #1 request.
2. **“Stop making me prompt-engineer”** — guided brief (wizard) beats raw text prompts.
3. **“I need 3D mockups”** — 3D-style assets for social/marketing (addressed via CSS 3D export).
4. **“Keep my series looking consistent”** — series mode with reference image (post-MVP).
5. **“Typography is always the problem”** — canvas editor with safe zones, fonts, and Kindle preview.
6. **“Does it actually work on KDP?”** — compliance checker and guaranteed dimensions/format.
7. **“Let me tweak one thing without regenerating everything”** — inpainting (region edit) in MVP.

---

## 17. Competitive Landscape

| Tool                  | Strengths                               | Weaknesses                                                |
| --------------------- | --------------------------------------- | --------------------------------------------------------- |
| **Canva AI**          | Huge template library, drag-and-drop    | Not book-publishing-specific; generic aesthetic          |
| **CoverDesignAI**     | Author-focused, 3D mockups, series mode | Paid only, limited free tier                              |
| **BookBrush**         | Built for authors, Amazon sizing        | Less AI, more template-based                              |
| **Midjourney / OpenAI** | Strong image quality                 | DALL-E 3 deprecated May 2026; no KDP compliance, no text overlay; prompt skill required |
| **KDP Cover Creator** | Free, built-in, compliant               | Very limited templates, outdated aesthetic                |

**Differentiation:** KDP-native compliance (dimensions, safe zones, checker) + guided genre-aware brief + text overlay (Konva) + optional inpainting + single flow from brief to export. Image model: **gpt-image-1.5** (current flagship; supports image input for future series/reference features).

---

## 18. Resolved Decisions

| Question                         | Decision                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Which image model at launch?     | **gpt-image-1.5** (best instruction-following, native editing + image input). DALL-E 3 deprecated May 2026.                             |
| Self-host or API?                | **API** at launch (OpenAI + Replicate). Self-host adds GPU/infra complexity with no MVP benefit.                                         |
| Typography: browser or server?   | **Browser** (Konva.js) for WYSIWYG; server (Sharp) only for final export flattening.                                                      |
| AI disclosure to user?          | Non-blocking reminder at export: “Amazon recommends disclosing AI-generated cover art.” Do not block the flow.                             |
| Free tier scope?                 | 3 generations/month, **low-res watermarked preview** (800×500), no JPEG export. Enough to evaluate quality, not to use commercially.       |
| Series mode storage?             | **Cloud-save** via R2; users select previous covers from project history. Local-only breaks multi-device workflow.                        |

---

*This document is a living spec. Update as user research, technical constraints, and business decisions evolve.*
