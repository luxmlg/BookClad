# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BookClad is an AI-powered ebook cover generator for Amazon KDP. Users describe their book, select genre/mood/style, and the app generates KDP-compliant cover images (1600x2560px). It has a canvas editor for typography, text baking, and export.

## Architecture

This is a **two-process** system:

1. **Next.js app** (`src/`) — Next.js 16 with App Router, React 19, Auth.js v5, Prisma 7 (with `@prisma/adapter-pg`), Tailwind CSS 4. Handles UI, API routes, and enqueues jobs via BullMQ.
2. **Worker** (`worker/`) — Standalone Node/Express process that consumes BullMQ jobs from Redis. Calls Gemini AI APIs (quick/detailed/premium tiers), upscales with Sharp (or Replicate if `REPLICATE_API_TOKEN` is set), crops to KDP dimensions, and uploads results to R2/S3. Runs with `concurrency: 2`, checks for stalled jobs every 30s (max 2 stalls before failure + credit refund), and sweeps for stale generations (>30 min in QUEUED/PROCESSING, >2 hours in RETRYING) on startup. Express serves WebSocket at `/ws/progress` and health check at `/health`.

The two processes share the same Postgres database and Redis instance but are **separate packages** with independent `node_modules` and `tsconfig.json`. The worker is excluded from the root `tsconfig.json`. The worker is an **ESM package** (`"type": "module"` in its `package.json`).

### Key data flow

1. User creates a `CoverProject` via the wizard (`/create`)
2. User triggers generation from the editor (`/editor/[id]`) → `POST /api/generations` → BullMQ job queued
3. Worker picks up job → generates images via AI → upscales → crops to KDP → uploads to storage → writes `GeneratedImage` rows
4. Editor receives real-time progress via WebSocket (singleton in `src/lib/use-generation-ws.ts`, one-shot HTTP fetch on mount/reconnect for reliability)
5. User edits on canvas (Konva/react-konva), adds typography, can bake text into covers
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
npm run db:seed           # Seed default attribute config (prisma/seed.ts)
```
The worker has its own `prisma/schema.prisma` (a separate copy, not a symlink) and its own Prisma client generated into `worker/src/generated/prisma`. After schema changes, update both schema files and regenerate both clients:
```
npx prisma generate
cd worker && npx prisma generate
```

### Build & Lint
```
npm run build              # Next.js production build
npm run lint               # ESLint (flat config)
npx tsc --noEmit           # Type-check root app
cd worker && npx tsc --noEmit  # Type-check worker (separate tsconfig)
```

No test framework is configured.

### Deployment (Railway)

The app and worker deploy as separate Railway services from the same repo. Railway's private networking (`*.railway.internal`) is **only available at runtime**, not during build.

- **Migrations**: Run at startup (`prisma migrate deploy && next start`), not during build, because the internal Postgres URL isn't reachable at build time.
- **Prisma client**: Generated via `postinstall` hook (`prisma generate`). Worker has its own in `worker/package.json` (`npx prisma generate && tsc`).
- **BullMQ/ioredis**: Must be lazy-initialized in the Next.js app to avoid Redis connection attempts during `next build` (static page generation phase). Use `getGenerationQueue()` instead of a top-level `Queue` instance.
- **`AUTH_URL`**: Must be set to the deployed URL (e.g., `https://bookclad-dev.up.railway.app`) for OAuth callbacks to work correctly.

## Generation Pipeline

Two job types in BullMQ, both routed to `generation.processor.ts`:
- `JOB_TYPE.GENERATE` — text-to-image from attribute prompt
- `JOB_TYPE.GENERATE_FROM_REFERENCE` — image-to-image using `referenceImageKey` (also used for bake)

The processor runs a **preflight health check** (`preflight()` in `worker/src/lib/health.ts`) before any work — verifies R2 storage and Postgres are reachable. If either is down, the job fails immediately without calling the Gemini API, saving API costs.

**Per-image pipeline**: The processor generates, processes, and saves each image to DB before starting the next (`generateSingleImage()` in `worker/src/services/gemini.service.ts`). This ensures that if an API call fails mid-sequence, previously generated images are already persisted and Path 2 (partial success) triggers correctly.

Pipeline branches on model:
- **Quick**: generate at 1K → upload raw (no upscale, no KDP crop) → store actual dimensions from Sharp metadata. Prototyping only, not export-ready.
- **Detailed/Premium**: generate at 4K → skip upscale (already exceeds KDP) → crop to 1600x2560 → upload to R2 → create `GeneratedImage` rows with KDP dimensions.

**Extension flow**: `POST /api/generations/[id]/extend` adds more images to an existing generation. Queues a `JOB_TYPE.GENERATE` job with `isExtension: true` and `imageCount` set to the **total** count (existing + new), not just the new images. `extensionImageCount` carries the new-images-only count for refund calculation. The processor loop `for (i = alreadyGenerated; i < imageCount)` skips already-persisted images and generates only the remainder.

The processor supports `isExtension` flag for partial-failure handling: if some images succeed before an error, mark COMPLETED with `imageCount` set to actual images created, then refund only the cost of images that weren't generated (using `extensionImageCount` for the math, not the total `imageCount`). Extensions do NOT auto-retry.

**Partial failure status**: When some images are generated before an error (Path 2), the generation is marked `COMPLETED` (not `FAILED`) with `errorMessage` set to a human-readable summary (e.g., "4 of 8 images generated. 20 credits refunded."). The original `imageCount` is preserved (not overwritten to the actual count) so the frontend can compute failed slot count as `imageCount - images.length`. Only `creditCost` is adjusted. `errorMessage` is cleared on successful extension, or updated with fresh numbers on extension partial failure. The frontend renders amber "failed slots" in generation history with retry capability via `onGenerateMore`.

**Auto-retry**: Failed generations automatically retry with exponential backoff (`RETRY_DELAYS`: 10s→30s→60s→90s→120s cap). BullMQ jobs are created with `attempts: 100` and a custom backoff strategy. The processor catch block classifies errors:
- **High demand** (429/503 or rate-limit patterns): retries up to `MAX_HIGH_DEMAND_RETRIES` (10), total ~13 min
- **Other errors**: retries up to `MAX_OTHER_RETRIES` (5), total ~5 min
- **Extensions**: never retry (throw `UnrecoverableError`)

Error classification runs BEFORE the partial-success check. This means retryable errors trigger retry even when some images already exist in DB. On retry, processors count existing images and skip them (`for (let i = alreadyGenerated; i < imageCount; i++)`), generating only the remaining ones. Only non-retryable errors with partial images trigger Path 2 (COMPLETED with errorMessage + partial refund).

On retryable failure: sets `status: RETRYING` with `retryCount`, `retryReason` (`"high_demand"` or `"error"`), `nextRetryAt`, and `errorMessage`. Publishes `EVENT_TYPE.RETRYING` via WebSocket. Re-throws the original error so BullMQ schedules the retry. Credits stay reserved (no refund until permanent failure or user cancellation).

On non-retryable failure with images: sets `status: COMPLETED` with `errorMessage`, partial refund. On non-retryable failure without images: sets `status: FAILED`, full refund.

The processor checks for user cancellation before processing and at the top of error handling: if `generation.status === FAILED` (set by cancel API), the processor returns early without doing any work or refunding (cancel API already refunded). Status updates in error handlers use conditional `updateMany` with `status: { not: FAILED }` to prevent double refunds.

**Cancellation**: `POST /api/generations/[id]/cancel` — only works on `RETRYING` or `QUEUED` status (rejects `PROCESSING`). Marks FAILED, refunds credits via `refundCredits()` from `src/lib/credits.ts`, best-effort removes the BullMQ job, and publishes a FAILED event via `getRedisPublisher()` from `src/lib/queue.ts`.

**Bake Layers**: Adds text/image layers into a generated cover via `GENERATE_FROM_REFERENCE`. Flow: user clicks "Bake Layers" in the toolbar → `flattenCanvasToDataUrl()` renders the canvas (image + text) at KDP resolution → calls `handleGenerateSimilar(prompt, true)` with `includeLayers: true` → creates `GENERATE_FROM_REFERENCE` job with flattened canvas as reference. Style toggle (`BakeStyle`: `"stylized"` or `"clean"`, defaults to stylized) controls whether text gets creative genre-appropriate effects or clean simple blending. Editing the prompt textarea deselects the style toggle; clicking a style button rebuilds the prompt.

**Bake aspect-ratio padding**: `padToAspectRatio()` in `worker/src/services/image.service.ts` pads the reference image from 5:8 (KDP) to 9:16 (Gemini output) using mirrored edges when `generation.includeLayers` is true. After generation, `cropToKDP()` removes only the padding — zero original content loss.

**Post-bake layer cleanup**: When a generation completes with `includeLayers === true`, visible layers are cleared from the image's layer cache (hidden layers preserved) to prevent baked text from appearing twice on subsequent edits.

## Editor Architecture

`EditorShell` (`src/components/editor/editor-shell.tsx`) is the main client-side state orchestrator. It wires together extracted hooks and sub-components:

- **Canvas types & constants** (`canvas-types.ts`): `TextNodeConfig`, `ImageNodeConfig`, `CanvasNode`, `CanvasState`, `NODE_TYPE`, `CANVAS_WIDTH`/`CANVAS_HEIGHT`/`SCALE`, `parseCanvasState`, `getDefaultCanvasState`. All editor files import types from here, not from `cover-canvas.tsx`.
- **Canvas snap-guide logic** (`src/lib/canvas.ts`): Pure `computeSnapGuides()` function, `Guide` interface, `SNAP_THRESHOLD`, grid line arrays.
- **Extracted hooks** (`hooks.ts`, `use-generation-actions.ts`):
  - `useLayerCache` — per-image layer caching with `layersCacheRef`
  - `useAutoSave` — debounced canvas + project persistence
  - `useToolbarPosition` — ResizeObserver/scroll tracking for fixed toolbars
  - `useKindlePreview` — debounced Konva-to-dataURL for Kindle preview
  - `useImageUrls` — fetches signed URLs for generated images
  - `useGenerationActions` — generation lifecycle, model/imageCount state, active generation tracking (includes `RETRYING` in active filters), `flattenCanvasToDataUrl` for bake
- **Attribute state**: `attributes` (per-project selections) + `attributeConfig` (user's attribute configuration, fetched from `/api/attributes`)
- **Generation lifecycle**: triggers generation via API, tracks active/completed generations, stores `attributeSnapshot`, `descriptionSnapshot`, and `textLayerSnapshot` with each generation for diff tracking and history display. All generation handlers (`handleRegenerate`, `handleGenerateSimilar`, `handleGenerateMore`) auto-open the bottom panel and switch to the History tab (`setActiveTab(0)`) so users see the new generation loading.
- **Draft attribute system**: When switching between history images, attribute edits are stashed per-image in `draftStashRef` and restored on return. `baseSnapshot` holds the generation's original attributes; `draftKeys` (derived via `computeAttributeDiff`) drives amber dot indicators on modified attributes.
- **Bottom panel tabs**: Both History and Queue tabs are **always mounted** (CSS `hidden`, not conditional rendering) in `EditorCenterPanel`. The Queue's `useGenerationProgress` hooks stay alive regardless of active tab.
- **Batch delete**: `DELETE /api/images/batch` — deletes entire generations when all images removed, decrements `imageCount` on partial deletes. `handleDeletedImages` in `EditorShell` cleans up all caches and auto-selects the next image.

Key sub-components: `EditorCenterPanel` (canvas viewport + bottom panel), `LeftSidebar` (attribute inputs, presets, brief), `RightSidebar` (layers, properties, export), `CoverCanvas` (Konva canvas), `GenerationHistory` → `GenerationGroup` (past generations with diffs via `DiffDisplay`), `GenerationQueue` (active jobs with WebSocket progress, retrying state with countdown timer + cancel button). Shared generation helpers (`getModelLabel`, `formatRelativeTime`, `JOB_TYPE_ICON`) live in `generation-helpers.ts`.

**Empty state toolbar**: When no images exist and no generation is active, the center panel shows model selector + image count + Generate button (not just "Generate Now"). Reads `?tab=history|queue` query params for navigation from dashboard.

### Canvas scale

Canvas renders at 400×640 (1/4 scale) in the editor, exports at full 1600×2560 KDP dimensions.

## Attribute System

Defined in `src/lib/attributes.ts`. Provides a flexible, user-customizable system for describing cover properties.

**Category types**: `single` (combobox), `multi` (badge toggles), `text` (textarea), `toggle` (switch), `scale` (slider 0-10 with optional endpoint labels), `color` (color picker + hex input), `palette` (curated color sets with 5 hex colors each).

**Storage**: `AttributeSelection = Record<string, string | string[]>`. All types store as strings — toggle stores `"true"`/`"false"`, scale stores `"5"`, color stores `"#3b82f6"`. No DB schema changes needed for new types.

**Shared utilities** (all in `attributes.ts`): `getDefaultValue(type)`, `slugify(text)`, `formatAttrValue(val)`, `formatAttributes(snapshot)`, `computeAttributeDiff(current, previous)`, `addValueToAttribute(config, id, value, label, description?, colors?)`, `removeValueFromAttribute(config, id, value)`, `getActiveValues(attribute)`. Use these instead of inline logic. `addValueToAttribute` deduplicates by value slug; `getActiveValues` filters disabled and deduplicates.

**Validation**: Zod schemas in `src/lib/attribute-validations.ts`. Attribute selection schema is also in `src/lib/validations.ts` as `attributeSelectionField`.

**Built-in attributes**: Genre, Mood, Art Style, Visual Elements, Color Palette — defined in `buildDefaultConfig()` with values from `src/lib/constants.ts`. `ensureBuiltInAttributes()` handles adding new built-in values to existing user configs. Built-in attributes can be hard-deleted in Settings; "Restore Built-in Attributes" adds them back via `ensureBuiltInAttributes()`.

**Worker prompt building**: `worker/src/lib/prompt.ts` builds prompts in three parts: `buildSystemPrompt(options)` (fixed instructions, controlled by `PromptOptions` = `{ includeLayers, textLayers, isReference }` — branches on bake mode vs normal reference vs no reference), `buildAttributeContext()` (attribute-level descriptions as context), and `buildAttributeValues()` (selected values with value descriptions). Text policy: when baking, lists exact text to render; otherwise, blocks text unless explicitly requested in user attributes. All attributes are treated uniformly — no hardcoded labels or special-casing. Attribute names, descriptions, and value labels come from the user's `AttributeConfig` via `extractDescriptions()`. The worker is a separate package and cannot import from `src/lib/`.

## Credit System

Billing uses a credit ledger instead of a generation counter. Defined in `src/lib/credits.ts` (app) and `worker/src/lib/credits.ts` (worker).

**Per-image costs**: `CREDIT_COST_PER_IMAGE` in constants — quick (3), detailed (5), premium (10). Also exposed as `creditCost` on each `AI_MODELS` entry.

**Tier allowances**: `TIER_CREDITS` — FREE (15 one-time on signup), STARTER (100/month), PRO (250/month), STUDIO (500/month).

**Credit pools**: `CreditPool` model tracks credit buckets with `source` (SUBSCRIPTION, PURCHASE, SIGNUP_GRANT, REFUND), `priority` (0=subscription, 1=others), `remaining`, and `expiresAt`. Subscription pools expire at `currentPeriodEnd` (no rollover), purchased pools expire after 12 months, signup/refund pools never expire. `User.creditBalance` is a denormalized cache updated atomically alongside pool changes. `spendCredits()` acquires a `SELECT ... FOR UPDATE` lock on the User row, then drains pools in priority order (subscription first, then FIFO by `createdAt`). Expiry sweep runs on worker startup and hourly via `worker/src/lib/credit-expiry.ts`.

**Lifecycle**:
1. API calls `reserveCredits()` → calls `spendCredits()` (row-level lock + pool drain) → creates `CreditTransaction(RESERVE)` + `Generation(creditCost)`. Throws `InsufficientCreditsError` (→ 403) if pools don't have enough.
2. On success: nothing to do, credits already deducted from pools.
3. On failure: worker calls `refundCredits()` — creates a REFUND `CreditPool` (no expiry), increments `creditBalance`, creates `CreditTransaction(REFUND)`.
4. On retryable failure: credits stay reserved (no refund until permanent failure or user cancellation).
5. On user cancel: app calls `refundCredits()` from `src/lib/credits.ts` (mirrors the worker version).
6. On grant: `grantCredits()` accepts `pool: { source, expiresAt, priority }` parameter, creates a `CreditPool` row alongside the balance increment.

**Credit sources**: Initial signup grant (Auth.js `createUser` event → `grantCredits()` for 15 FREE credits with SIGNUP_GRANT pool), subscription renewal (webhook → inline pool creation in single transaction, no rollover), plan changes (webhook → zeros old subscription pool, creates new one with full tier credits), and one-time credit pack purchases (webhook → `grantCredits()` with PURCHASE pool, 12-month expiry).

**API**: `GET /api/credits?page=N` returns `{ balance, tier, subscriptionStatus, currentPeriodEnd, dodoSubscriptionId, transactions[], page, totalPages }`. Paginated at 20 transactions per page. Client module in `src/lib/api/credits.ts`.

**DB**: `CreditTransaction` model with `amount` (positive=credit, negative=debit), `balanceAfter` snapshot, `type` enum (`GRANT`, `RESERVE`, `REFUND`, `EXPIRE`), optional `generationId` link.

## Payment System

Payments are handled by DodoPayments. Defined in `src/lib/dodo.ts` (SDK client + product ID mapping).

**Subscription flow**: User clicks "Upgrade" on billing tab → `POST /api/checkout` creates DodoPayments checkout session → user redirected to hosted checkout → payment completes → webhook fires at `POST /api/webhooks/dodo` → tier upgraded + credits granted.

**Checkout**: `POST /api/checkout` accepts a discriminated union: `{ type: "subscription", tier: "STARTER" | "PRO" | "STUDIO" }` for tier upgrades, or `{ type: "credits", packId: CreditPackId }` for one-time credit packs. Creates a DodoPayments checkout session and returns `{ checkoutUrl }`. Client helpers in `src/lib/api/checkout.ts`: `createCheckout(tier)`, `createCreditPackCheckout(packId)`, `createCustomerPortal()`.

**Credit packs**: One-time purchases defined in `CREDIT_PACKS` constant (50/$5, 100/$9, 250/$20, 500/$35). Product IDs in env: `DODO_PRODUCT_ID_CREDITS_50`, `DODO_PRODUCT_ID_CREDITS_100`, `DODO_PRODUCT_ID_CREDITS_250`, `DODO_PRODUCT_ID_CREDITS_500`. Mapped via `DODO_CREDIT_PACK_IDS` in `src/lib/dodo.ts`. Purchased packs expire after 12 months.

**SDK client**: Singleton `dodo` in `src/lib/dodo.ts`. Uses `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, and `DODO_PAYMENTS_ENVIRONMENT` ("test_mode" or "live_mode") from env. Subscription product IDs in `DODO_PRODUCT_ID_STARTER`, `DODO_PRODUCT_ID_PRO`, and `DODO_PRODUCT_ID_STUDIO`. Helpers: `tierFromProductId()`, `productIdFromTier()`, `creditsFromProductId()`.

**Priority queue**: Pro and Studio users get BullMQ priority 1 (vs 10 for Free/Starter). Set via `TIER_QUEUE_PRIORITY` constant. Added to job options in both generation and extend API routes.

**Webhook handler**: `src/app/api/webhooks/dodo/route.ts` — verifies signature via SDK `unwrap()`, handles subscription and payment events. Uses `WebhookEvent` model for idempotency (webhook-id as primary key, exactly-once processing).

**Customer management**: DodoPayments customers are created lazily on first checkout. `User.dodoCustomerId` links to the Dodo customer. Customer portal accessible via `POST /api/customer-portal`.

**Constants**: `SUBSCRIPTION_STATUS`, `PLAN_PRICES`, `CREDIT_PACKS` in `src/lib/constants.ts`.

**Local testing**: Set `DODO_PAYMENTS_ENVIRONMENT=test_mode`, create test products in Dodo dashboard, use ngrok pointing to port 3000 with webhook URL `https://<ngrok>/api/webhooks/dodo`.

## Font System

`src/lib/fonts.ts` manages font loading and registration:
- **Built-in fonts**: Curated list organized by category (serif, sans-serif, display, monospace) in `FONTS_BY_CATEGORY`
- **Custom fonts**: Users upload via `/api/fonts/upload`, stored in R2. `loadCustomFont()` uses FontFace API. In-memory registry tracks loaded custom fonts.
- **Migration**: `FONT_MIGRATION_MAP` handles legacy system font → modern font substitution
- **Default font**: Per-user preference stored in DB, configurable in settings

## Storage

`src/lib/storage.ts` abstracts file storage with dual-mode support:
- **Production**: Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3`. Requires `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` env vars.
- **Dev**: Falls back to local `uploads/` directory when `R2_ENDPOINT` is unset. Served via `/api/uploads/` route.

Functions: `getSignedDownloadUrl(key)`, `downloadFromStorage(key)`, `uploadToStorage(key, body, contentType)`, `deleteFromStorage(key)`. The `useLocalStorage` flag is derived from the environment automatically.

The worker has its own storage module (`worker/src/services/storage.service.ts`) with the same dual-mode pattern, plus `checkStorageHealth()` for preflight checks.

**Storage cleanup on deletion**: Both `DELETE /api/images/batch` and `DELETE /api/projects/[id]` collect all storage keys (generated images, user assets) and delete them from R2 in the background.

## Credit Store

`src/lib/stores/credit-store.ts` — Zustand store for real-time credit balance display. `CreditHydrator` component (rendered in the root layout) hydrates the store from the server-side session balance. After credit-consuming operations (generation), call `useCreditStore.getState().refreshCredits()` to update the navbar badge. Import via `useCreditStore` hook or `useCreditStore.getState()` for non-React contexts.

## AI Fill

`src/lib/ai-fill.ts` provides AI-powered attribute suggestions. Users click "AI Fill" in the left sidebar, describe what they want, and Gemini suggests attribute changes.

**Flow**: `AiFillPopover` (textarea + generate button) → `POST /api/attributes/generate` → Gemini `gemini-2.5-flash` with structured JSON output → `AiFillReviewDialog` (checklist with inline editing) → user applies selected suggestions.

**Cost**: 1 credit per AI Fill call (`AI_FILL_CREDIT_COST`). Uses `reserveAiFillCredits()` — same atomic Prisma transaction pattern as generation credits, but with `generationId: null` on the `CreditTransaction`.

**Prompt design**: The system prompt in `ai-fill.ts` instructs Gemini to think holistically (update all affected attributes when direction shifts), always rewrite Visual Elements, prefer structured attributes over text dumps, and suggest 2-3 new attributes when they'd improve generation quality.

**Apply logic**: `handleApplyAiFill` in `left-sidebar.tsx` handles three cases: new attributes (checks for existing ID collision via `slugify`), new values on existing attributes (deduplicates before adding), and value updates. After applying, calls `refreshCredits()` on the credit store.

**Client API**: `src/lib/api/ai-fill.ts` — `generateAttributes(projectId, prompt)`.

## AI Edit (Settings)

`POST /api/attributes/edit` provides AI-powered attribute config editing in Settings → Attributes tab. Users describe structural changes in natural language (add/remove attributes, add/remove values, modify descriptions), and Gemini returns a modified `AttributeConfigJson`. The client diffs before/after via `diffAttributeConfigs()` in `src/lib/attribute-diff.ts` and shows a review dialog with checkboxes.

**Cost**: 1 credit per call (same `reserveAiFillCredits()` pattern as AI Fill). Credits are not refunded on Gemini failure.

**Diff engine**: `src/lib/attribute-diff.ts` — pure functions `diffAttributeConfigs(before, after)` returns `ConfigChange[]`, `applyConfigChanges(config, changes, selectedIndices)` applies only checked changes. Changes are typed: `add-attribute`, `remove-attribute`, `modify-attribute` (per field), `add-value`, `remove-value`, `modify-value`.

**Built-in attribute deletion**: All attributes (including built-in) can be hard-deleted from the config. "Restore Built-in Attributes" button calls `ensureBuiltInAttributes()` to add back missing ones without touching custom attributes.

**UI**: `AiEditPopover` (`src/app/settings/ai-edit-popover.tsx`) + `AiEditReviewDialog` (`src/app/settings/ai-edit-review-dialog.tsx`), wired into `attributes-tab.tsx`.

## Landing Page

`src/app/page.tsx` is an async server component that checks the user's session to conditionally render CTA text. Page flow: Hero (with `CoverShowcase`) → `ProductShowcase` → Features → Pricing → Footer.

**Session-aware hero**: Logged-in users see "Create a Cover" button; anonymous users see "Start Free" with a "15 free credits" tagline. Pricing plan buttons link to `/settings?tab=billing` for paid tiers (Starter/Pro/Studio) and `/create` for the Free tier.

### Animation library

Uses the `motion` package (Framer Motion v12+). **Import from `motion/react`**, not `framer-motion`. Components: `motion`, `AnimatePresence` for enter/exit transitions.

### Components (`src/components/landing/`)

- **`CoverShowcase`** — Scroll-driven fan-to-carousel transition. Three covers start fanned (rotated, overlapping), then morph into a full 8-cover Embla carousel as the user scrolls. Uses a single Embla DOM with per-slide CSS transform interpolation driven by `window.scrollY` (progress 0→1 over 100-400px scroll range). The fan is dynamic — it centers on whichever slide the user last viewed in the carousel (wraps with loop). Embla config: `{ loop: true, align: "center", startIndex: 1 }` with `embla-carousel-autoplay`. No `reInit` — drag is always enabled; fan inline styles override visuals during transition.
- **`FadeIn`** — Reusable `motion.div` wrapper with `whileInView` trigger. Accepts `delay`, `duration`, `y` props. Used throughout the landing page for scroll-reveal animations.
- **`ThemedImage`** — Renders both light and dark `next/image` elements, crossfades with `transition-opacity` based on `resolvedTheme` from `next-themes`. Uses `useSyncExternalStore` for hydration-safe mounted detection (not `useEffect`+`useState`).
- **`ProductShowcase`** — Four alternating image+text rows using `FadeIn` and `ThemedImage`. Screenshots in `public/landing/` with light/dark variants.

### Static assets

Cover images: `public/landing/covers/cover-{1-8}.jpg`. Product screenshots: `public/landing/{create,editor,results,canvas}-{light,dark}.png`.

## Privacy Policy

`src/app/privacy/page.tsx` — static, public page at `/privacy` listing all data BookClad collects, how it's used, third-party services, cookies, retention, user rights, and security. Linked from the landing page footer, sign-in page, and Settings General tab.

**Keep it in sync**: When adding a new third-party service, collecting new user data, adding analytics/tracking, or changing data retention practices, update the privacy policy page to reflect the change. The "Last updated" date at the top should be updated when content changes.

## Account Deletion

`DELETE /api/account` — authenticated endpoint that permanently deletes a user's account. Flow:
1. Collects all R2 storage keys (generated images, masks, assets, exports, fonts)
2. Best-effort cancels active DodoPayments subscription via `dodo.subscriptions.update(id, { status: "cancelled" })`
3. Deletes User record (Prisma `onDelete: Cascade` handles all related DB records)
4. Background R2 cleanup (fire-and-forget)

Triggered from Settings General tab → "Danger Zone" → `DeleteAccountDialog` (requires typing "DELETE" to confirm). Uses client-side `signOut` from `next-auth/react` after deletion.

## Code Standards

### File size & component structure
- Keep files under ~300 lines. When a file grows beyond that, extract sub-components or utilities.
- One component per file. If a component has private sub-components, extract them to their own files when they exceed ~50 lines.
- Group related code by domain, not by kind. E.g., attribute types, utilities, and constants all live in `src/lib/attributes.ts` — not split across `types/`, `utils/`, `constants/`.

### Types
- Every function must have explicit input parameter types and return type annotations — no implicit `any`.
- Use `unknown` over `any` when the type is truly not known. Narrow with type guards.
- Define domain types in the relevant `src/lib/*.ts` file (e.g., attribute types in `attributes.ts`). Import from there — never re-define the same shape in multiple places.
- Use `interface` for object shapes that may be extended, `type` for unions, intersections, and aliases.
- Export types alongside the functions that use them from the same file.

### No magic values
- Never inline literal strings, numbers, or colors that carry domain meaning. Define a named constant and import it.
- Repeated values like default colors (`"#6366f1"`), scale ranges (`0-10`), canvas dimensions (`1600x2560`), etc., must come from constants or utility functions (e.g., `getDefaultValue("color")`).
- Prefer enum-like `as const` objects over raw string unions when the set of values is used in multiple places.

### DRY — shared utilities over inline logic
- If the same logic appears in 2+ files, extract it into a shared utility in `src/lib/`.
- Use existing utilities: `slugify()`, `getDefaultValue()`, `addValueToAttribute()`, `removeValueFromAttribute()`, `formatAttrValue()`, `computeAttributeDiff()`, `getActiveValues()` from `src/lib/attributes.ts`. Check for existing helpers before writing new inline code.
- Config transformation helpers should be pure functions that take state in and return new state — not methods with side effects.

### Component props
- Define a named `interface` for component props (e.g., `interface PresetPickerProps`), not inline object types.
- Callbacks should be named descriptively: `onApplyPreset`, `onConfigChange` — not `onChange` or `handler`.

### Readability
- Prefer early returns and guard clauses over deeply nested ternaries or if/else chains.
- Avoid nested ternaries beyond 2 levels — use a `switch`, a lookup object, or extract a function.
- Keep JSX render bodies focused. If a render branch exceeds ~30 lines, extract it into a named component.

## Important Conventions

- **Prisma client import**: Use `import { PrismaClient } from "@/generated/prisma/client"` (not `@prisma/client`) — the client is generated to a custom output path.
- **Validation**: All API request bodies are validated with Zod schemas from `src/lib/validations.ts`. Schemas derive allowed values from `src/lib/constants.ts`.
- **Auth pattern**: Auth.js v5 with database sessions. Providers: Google, Apple, Amazon (custom OAuth) — all with `allowDangerousEmailAccountLinking` (safe because all providers verify emails). Apple and Amazon buttons are conditionally shown based on env vars (`AUTH_APPLE_ID`/`AUTH_APPLE_SECRET`, `AUTH_AMAZON_ID`/`AUTH_AMAZON_SECRET`). API routes check `const session = await auth()` from `src/lib/auth.ts`, then verify `session?.user?.id`. Protected pages redirect via middleware in `src/proxy.ts` (checks `/dashboard`, `/create`, `/editor` routes for session cookie). `createUser` event auto-creates `AttributeConfig` and grants initial credits. The navbar is hidden on `/sign-in` via `NavbarWrapper` (`src/components/layout/navbar-wrapper.tsx`), a client component that checks `usePathname()`.
- **BullMQ queue**: `QUEUE_NAME` (`"cover-generation"`). The Next.js app uses `getGenerationQueue()` from `src/lib/queue.ts` (lazy-initialized to avoid Redis connections at build time). The worker consumes via its own BullMQ Worker. Job type constants in `JOB_TYPE`: `GENERATE`, `GENERATE_FROM_REFERENCE`. Redis connections must include `password` and `username` from the URL — don't parse only host/port.
- **Storage**: Images go to Cloudflare R2 (S3-compatible). Dev can use local `uploads/` directory.
- **UI components**: shadcn/ui in `src/components/ui/`. The canvas editor uses Konva via `react-konva` (dynamically imported to avoid SSR).
- **UI primitives are `@base-ui/react`** (not Radix). shadcn/ui provides the component structure/styling but all primitives (`Dialog`, `Menu`, `Select`, `Collapsible`, etc.) come from base-ui. Key gotchas vs Radix:
  - `DropdownMenuItem` has no `onSelect` — use `onClick`.
  - `DropdownMenuContent` unmounts children when the menu closes. Never render a `Dialog` inside it — render the dialog as a sibling of `DropdownMenu` with shared state in the parent.
  - `SelectValue` doesn't auto-map values to labels — pass explicit children: `<SelectValue>{label}</SelectValue>`.
- **AI models**: All Gemini — quick (`gemini-3.1-flash-image-preview` at 1K, no thinking), detailed (`gemini-3.1-flash-image-preview` at 4K, High thinking), premium (`gemini-3-pro-image-preview` at 4K, no explicit thinking config). Quick and Detailed share the same model ID but differ by resolution and thinking settings. Model IDs mapped in `GEMINI_MODEL_IDS` in `worker/src/lib/constants.ts`. Per-model generation config in `GEMINI_MODEL_CONFIG`. Quick is prototyping-only: no upscale, no KDP crop, not export-ready. Detailed/Premium output at 4K, skip upscale (already exceeds KDP), crop to 1600x2560. `AI_MODELS` entries have `exportable: boolean` field — Quick is `false`, others are `true`. Export API and UI gate on this.
- **KDP constants**: Defined in both `src/lib/constants.ts` and `worker/src/lib/constants.ts` as `KDP` object (1600x2560, 300 DPI, JPEG quality 92). Gemini generates at 9:16 aspect ratio; `cropToKDP()` center-crops to 5:8 (KDP). For bake mode, `padToAspectRatio()` pads to 9:16 first so the crop only removes padding.
- **Redis subscriber connections**: ioredis connections used for pubsub (`subscriber.subscribe()`) must set `enableReadyCheck: false` to prevent the `INFO` health-check command from crashing in subscribe mode.
- **WebSocket**: Singleton manager in `src/lib/use-generation-ws.ts`. Worker endpoint at `NEXT_PUBLIC_WS_URL` (defaults to `ws://localhost:4000/ws/progress`). No polling fallback — reliability is ensured by one-shot HTTP fetches on mount and WebSocket reconnect. Supports two subscription types: `generation:{id}` (granular progress for editor) and `project:{projectId}` (status transitions for dashboard). The worker bridges Redis pubsub → WebSocket: `publishProgress()` in `worker/src/lib/progress.ts` publishes to both channels, and `worker/src/lib/websocket.ts` relays to connected clients. Hooks: `useGenerationProgress(id, options?)` for per-generation progress, `useProjectGenerations(projectId, initial)` for dashboard active generations.
- **Event constants**: Event type discriminators (`EVENT_TYPE`: STATUS, PROGRESS, COMPLETED, FAILED, RETRYING) and WebSocket control messages (`WS_MESSAGE_TYPE`: SUBSCRIBE, UNSUBSCRIBE, SUBSCRIBE_PROJECT, UNSUBSCRIBE_PROJECT) are defined in both `src/lib/constants.ts` and `worker/src/lib/constants.ts`. Use these instead of raw strings like `"completed"` or `"subscribe"`.
- **Generation statuses**: `GENERATION_STATUS` includes `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING`. The `RETRYING` status is used during auto-retry — generation has retry fields (`retryCount`, `retryReason`, `nextRetryAt`) that drive countdown timers and retry labels in the UI. `GenerationProgress` interface in `use-generation-ws.ts` also carries these fields.
- **Dashboard active generations**: `src/components/dashboard/active-generation-row.tsx` (client component) renders active generation rows under project cards on the dashboard. Uses `useProjectGenerations` hook (WebSocket subscription to `project:{projectId}` channel) with one-shot HTTP fetch on mount/reconnect. Clicking navigates to the editor with `?tab=history&gen=ID`.
- **Redis publisher**: `getRedisPublisher()` from `src/lib/queue.ts` provides a lazy-initialized ioredis instance for publishing WebSocket events from the Next.js app (used by the cancel API).
- **Attribute defaults**: Always use `getDefaultValue(type)` from `src/lib/attributes.ts` — never hardcode default values like `"false"`, `"5"`, `"#6366f1"` inline.
- **API client**: Client-side API calls use an axios instance from `src/lib/api/client.ts` with domain-specific modules in `src/lib/api/` (projects, generations, images, fonts, settings, credits, checkout). Use `fireAndForget()` for best-effort calls (auto-save). Import via `@/lib/api`.
- **Cross-package constants**: Constants shared between app and worker (like `GENERATION_STATUS`, `EVENT_TYPE`, `KDP`, `CREDIT_COST_PER_IMAGE`) are defined in both `src/lib/constants.ts` and `worker/src/lib/constants.ts` — kept in sync manually since the packages cannot import from each other.
- **Credit costs**: Always use `CREDIT_COST_PER_IMAGE[model]` and `calculateCreditCost()` from `src/lib/credits.ts` — never hardcode credit amounts inline.
- **GeneratedImage ordering**: Always include `orderBy: { id: "asc" }` when querying `images` on a generation. CUIDs are monotonically increasing, so this ensures images render in creation order — critical for extend-generation where new images must appear after existing ones.
- **Webhook endpoint**: `POST /api/webhooks/dodo` must NOT use `auth()` — it's called by DodoPayments servers and authenticated via webhook signature verification. Raw body must be read with `request.text()` before any JSON parsing for signature verification to work.
