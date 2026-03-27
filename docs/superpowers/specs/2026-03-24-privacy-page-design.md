# Privacy Page & Account Deletion Design

## Goal

Add a `/privacy` page with a plain-language, hybrid privacy policy covering all real data practices in BookClad. Also add account deletion capability so users can exercise their right to delete their data.

## Architecture

Static server-rendered TSX page at `/privacy`. Account deletion via `DELETE /api/account` endpoint, triggered from a new "Danger Zone" section in Settings General tab.

## Scope

Two features:
1. Privacy policy page (`/privacy`)
2. Account deletion (API + Settings UI)

---

## 1. Privacy Page

### Route

`/privacy` — public, no auth required.

### Layout

Same app shell (navbar). Centered content column (`max-w-3xl`), similar to `/create` styling. "Last updated: [date]" at the top.

### Content Sections

**1. What We Collect**
- Account info: name, email, profile image (from OAuth providers)
- Project data: titles, author names, descriptions, attribute selections
- Generated images and AI prompts
- Uploaded fonts and assets
- Payment/billing data via DodoPayments (we never store or see card numbers)
- Credit transaction history
- Feedback submissions (text and optional screenshots)

**2. How We Use Your Data**
- Authentication and session management
- AI cover generation and attribute suggestions: prompts, descriptions, and attribute data sent to Google Gemini
- Image storage on Cloudflare R2
- Billing via DodoPayments
- No marketing use, no data selling, no profiling

**3. Third-Party Services**
Each with a one-line description of what data they receive:
- Google: OAuth sign-in + Gemini AI (prompts, attributes for image generation)
- Apple: OAuth sign-in (email, name)
- Amazon: OAuth sign-in (email, name)
- DodoPayments: Payment processing (email, subscription/purchase data)
- Cloudflare R2: File storage (generated images, uploaded assets)

**4. Cookies & Local Storage**
- One auth session cookie (HttpOnly, Secure in production). No tracking cookies.
- localStorage keys for UI preferences (panel height, per-project image count). No personal data stored in localStorage.

**5. Data Retention**
- Data kept while account exists
- Deleted projects and images permanently removed from storage
- Credit transactions retained for billing records

**6. Your Rights**
- Delete individual projects and images anytime from the editor
- Delete your entire account from Settings (cascades to all data)
- Export covers as high-resolution images

**7. Security**
- Database-backed sessions (not JWT)
- Webhook signature verification for payment events
- Signed URLs with 1-hour expiry for file access
- OAuth tokens stored securely in database

**8. Changes**
- "We may update this policy. Last updated: [date]."

**9. Contact**
- "Questions? Use the feedback form in the app."

### Navigation Links

Add "Privacy" links in three places:
- Landing page footer (existing footer section in `src/app/page.tsx`)
- Sign-in page — small link below OAuth buttons
- Settings General tab — near the Delete Account section

---

## 2. Account Deletion

### Settings UI

Add a "Danger Zone" section at the bottom of the Settings General tab. Contains a red "Delete Account" button.

**Confirmation dialog:**
- Explains what will be permanently deleted: all projects, generated images, uploaded fonts, presets, credit history, and account data
- User must type "DELETE" to confirm (prevents accidental clicks)
- Cancel and Delete buttons; Delete button only enabled when input matches

### API Endpoint

`DELETE /api/account` — requires authentication.

**Flow:**
1. Verify authenticated user via `auth()`
2. Collect all R2 storage keys for the user:
   - Generated images (`GeneratedImage.storageKey`)
   - User assets (`UserAsset.storageKey`)
   - Custom fonts (`CustomFont.storageKey`)
   - Mask images (`Generation.maskImage`)
   - Exports (`Export.storageKey`)
   - Feedback images (pattern: `feedback/{userId}/*`)
   - Note: `Generation.referenceImage` references an existing `GeneratedImage.storageKey`, so no separate cleanup needed
3. Delete all R2 files (best-effort, in background — don't block on storage cleanup)
4. Best-effort cancel active DodoPayments subscription if `dodoSubscriptionId` exists (`dodo.subscriptions.cancel()`). Proceed regardless of outcome.
5. Delete the User record from database (Prisma `onDelete: Cascade` handles all related records: accounts, sessions, projects, generations, images, credit transactions, fonts, presets, attribute config)
6. Return 200

**After deletion on client side:**
- Sign the user out (redirect to `/`)
- Show a toast confirmation

### What Gets Deleted (Prisma cascade)

- User record + all linked OAuth accounts and sessions
- All CoverProjects, Generations, GeneratedImages
- All UserAssets, CustomFonts
- All CreditTransactions
- All StylePresets, AttributeConfig
- All files in R2 storage (best-effort)
- Note: WebhookEvent records are not user-linked and are retained for idempotency (they contain no PII)

### What Doesn't Get Deleted

- DodoPayments customer record (external system). Mentioned in privacy policy — user can contact DodoPayments directly.
- Webhook idempotency records (no PII)

### Active Subscription Handling

The deletion API attempts to cancel any active DodoPayments subscription via `dodo.subscriptions.cancel()` before deleting the user. This is best-effort — if cancellation fails, deletion proceeds anyway. The confirmation dialog warns users with active subscriptions that cancellation will be attempted but they should verify with DodoPayments if concerned.

### In-Flight Generations

If a generation job is QUEUED or PROCESSING in BullMQ when the account is deleted, the worker will fail when it tries to write results (the Generation row was cascade-deleted). The worker's existing error handling catches this. Orphaned R2 files from in-flight jobs are an accepted trade-off — they're small and rare.
