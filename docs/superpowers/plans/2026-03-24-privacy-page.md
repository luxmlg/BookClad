# Privacy Page & Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/privacy` page with plain-language privacy policy and account deletion from Settings.

**Architecture:** Static server-rendered TSX page at `/privacy`. Account deletion via `DELETE /api/account` with R2 cleanup and Prisma cascade. Confirmation dialog with "type DELETE" guard in Settings General tab. Privacy links added to landing footer, sign-in page, and settings.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Cloudflare R2, DodoPayments SDK, AlertDialog (base-ui)

**Spec:** `docs/superpowers/specs/2026-03-24-privacy-page-design.md`

---

## File Structure

**Create:**
- `src/app/privacy/page.tsx` — Static privacy policy page
- `src/app/api/account/route.ts` — DELETE endpoint for account deletion
- `src/lib/api/account.ts` — Client-side API module for account deletion
- `src/components/settings/delete-account-dialog.tsx` — Confirmation dialog with "type DELETE" guard

**Modify:**
- `src/app/settings/general-tab.tsx` — Add Danger Zone section with delete button
- `src/app/page.tsx` — Add Privacy link to landing footer
- `src/app/(auth)/sign-in/page.tsx` — Add Privacy link below OAuth buttons
- `src/lib/api/index.ts` — Export new account module

---

### Task 1: Privacy Page

**Files:**
- Create: `src/app/privacy/page.tsx`

- [ ] **Step 1: Create the privacy page**

```tsx
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — BookClad",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 24, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            What We Collect
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Account information</strong>{" "}
              — name, email address, and profile image from your sign-in
              provider (Google, Apple, or Amazon).
            </li>
            <li>
              <strong className="text-foreground">Project data</strong> — book
              titles, author names, descriptions, and cover attribute selections
              you create.
            </li>
            <li>
              <strong className="text-foreground">Generated images</strong> —
              cover images produced by AI based on your prompts and attributes.
            </li>
            <li>
              <strong className="text-foreground">Uploaded files</strong> —
              custom fonts and reference images you upload.
            </li>
            <li>
              <strong className="text-foreground">Payment data</strong> —
              subscription and purchase information processed by DodoPayments. We
              never store or see your card numbers.
            </li>
            <li>
              <strong className="text-foreground">Credit history</strong> —
              records of credit grants, usage, and refunds for billing purposes.
            </li>
            <li>
              <strong className="text-foreground">Feedback</strong> — text and
              optional screenshots you submit through the feedback form.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            How We Use Your Data
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Authentication</strong> — to
              sign you in and maintain your session.
            </li>
            <li>
              <strong className="text-foreground">
                AI image generation and attribute suggestions
              </strong>{" "}
              — your prompts, descriptions, and attribute selections are sent to
              Google Gemini to generate cover images and suggest attributes.
            </li>
            <li>
              <strong className="text-foreground">File storage</strong> —
              generated images and uploaded assets are stored on Cloudflare R2.
            </li>
            <li>
              <strong className="text-foreground">Billing</strong> —
              subscription and credit pack purchases are processed by
              DodoPayments.
            </li>
          </ul>
          <p className="mt-3">
            We do not sell your data, use it for marketing, or build advertising
            profiles.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Third-Party Services
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Google</strong> — OAuth
              sign-in and Gemini AI for image generation and attribute
              suggestions.
            </li>
            <li>
              <strong className="text-foreground">Apple</strong> — OAuth
              sign-in (email and name).
            </li>
            <li>
              <strong className="text-foreground">Amazon</strong> — OAuth
              sign-in (email and name).
            </li>
            <li>
              <strong className="text-foreground">DodoPayments</strong> —
              payment processing for subscriptions and credit packs.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare R2</strong> — file
              storage for generated images and uploaded assets.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Cookies &amp; Local Storage
          </h2>
          <p>
            We use a single authentication cookie to maintain your session. It is
            HttpOnly and Secure in production. We do not use tracking cookies or
            third-party analytics.
          </p>
          <p className="mt-2">
            We store UI preferences (panel height, per-project image count) in
            your browser&apos;s localStorage. No personal data is stored in
            localStorage.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Data Retention
          </h2>
          <p>
            Your data is kept for as long as your account exists. When you delete
            a project or image, it is permanently removed from our storage.
            Credit transaction records are retained for billing purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Your Rights
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Delete individual projects and images at any time from the editor.</li>
            <li>Export your covers as high-resolution images.</li>
            <li>
              Delete your entire account from{" "}
              <Link href="/settings" className="text-foreground underline underline-offset-2">
                Settings
              </Link>
              . This permanently removes all your data including projects,
              images, fonts, presets, and credit history.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Security
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sessions are stored in our database (not client-side tokens).</li>
            <li>Payment webhook signatures are verified before processing.</li>
            <li>File download URLs expire after one hour.</li>
            <li>OAuth tokens are stored securely in our database.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Changes to This Policy
          </h2>
          <p>
            We may update this policy from time to time. The &quot;Last
            updated&quot; date at the top will reflect the most recent revision.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Contact
          </h2>
          <p>
            Questions about your data or this policy? Use the feedback form
            inside the app.
          </p>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors

Then start dev server and visit `http://localhost:3000/privacy` to confirm it renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat: add /privacy page with plain-language privacy policy"
```

---

### Task 2: Navigation Links

**Files:**
- Modify: `src/app/page.tsx:291-309` — add Privacy link to footer
- Modify: `src/app/(auth)/sign-in/page.tsx:82` — add Privacy link below OAuth buttons

- [ ] **Step 1: Add Privacy link to landing page footer**

In `src/app/page.tsx`, inside the footer links `<div>` (after the Pricing link around line 309), add:

```tsx
<Link
  href="/privacy"
  className="transition-colors hover:text-foreground"
>
  Privacy
</Link>
```

- [ ] **Step 2: Add Privacy link to sign-in page**

In `src/app/(auth)/sign-in/page.tsx`, after the closing `</CardContent>` tag (line 82) and before the closing `</Card>` tag (line 83), add:

```tsx
<div className="px-6 pb-6 text-center">
  <Link
    href="/privacy"
    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
  >
    Privacy Policy
  </Link>
</div>
```

Add `import Link from "next/link";` to the top of the file.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/\(auth\)/sign-in/page.tsx
git commit -m "feat: add privacy links to landing footer and sign-in page"
```

---

### Task 3: Account Deletion API

**Files:**
- Create: `src/app/api/account/route.ts`

**Reference:** Follow the R2 cleanup pattern from `src/app/api/projects/[id]/route.ts:94-124` — collect storage keys, Prisma delete, background cleanup.

**Reference:** `src/lib/dodo.ts` for the DodoPayments SDK client. The subscription cancellation method is `dodo.subscriptions.update(subscriptionId, { status: "cancelled" })` — check the DodoPayments SDK docs if this doesn't compile.

**Reference:** `prisma/schema.prisma:14-42` for User model — all relations have `onDelete: Cascade`.

- [ ] **Step 1: Create the DELETE endpoint**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";
import { dodo } from "@/lib/dodo";

export async function DELETE(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch user with all data that has storage keys
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        dodoSubscriptionId: true,
        subscriptionStatus: true,
        projects: {
          select: {
            generations: {
              select: {
                maskImage: true,
                images: { select: { storageKey: true } },
              },
            },
            assets: { select: { storageKey: true } },
            exports: { select: { storageKey: true } },
          },
        },
        fonts: { select: { storageKey: true } },
      },
    });

    // Collect all R2 storage keys
    const storageKeys: string[] = [];
    for (const project of user.projects) {
      for (const gen of project.generations) {
        if (gen.maskImage) storageKeys.push(gen.maskImage);
        for (const img of gen.images) {
          storageKeys.push(img.storageKey);
        }
      }
      for (const asset of project.assets) {
        storageKeys.push(asset.storageKey);
      }
      for (const exp of project.exports) {
        storageKeys.push(exp.storageKey);
      }
    }
    for (const font of user.fonts) {
      storageKeys.push(font.storageKey);
    }

    // Best-effort cancel active DodoPayments subscription
    if (user.dodoSubscriptionId && user.subscriptionStatus === "ACTIVE") {
      try {
        await dodo.subscriptions.update(user.dodoSubscriptionId, {
          status: "cancelled",
        });
      } catch {
        // Proceed regardless — best effort
      }
    }

    // Delete user — Prisma cascade handles all related records
    await prisma.user.delete({ where: { id: session.user.id } });

    // Clean up R2 storage in background
    Promise.all(storageKeys.map((key) => deleteFromStorage(key))).catch(
      () => {},
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

Note: If the DodoPayments SDK method `dodo.subscriptions.update(id, { status: "cancelled" })` doesn't compile, check the SDK types for the correct cancellation method. It may be `dodo.subscriptions.cancel(id)` or similar. Adjust accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/account/route.ts
git commit -m "feat: add DELETE /api/account endpoint with R2 cleanup and subscription cancellation"
```

---

### Task 4: Client API Module

**Files:**
- Create: `src/lib/api/account.ts`
- Modify: `src/lib/api/index.ts`

**Reference:** Follow the pattern from `src/lib/api/quick-create.ts` — thin wrapper around the axios client.

- [ ] **Step 1: Create the client module**

```typescript
import api from "./client";

export async function deleteAccount(): Promise<void> {
  await api.delete("/api/account");
}
```

- [ ] **Step 2: Export from index**

In `src/lib/api/index.ts`, add:

```typescript
export * from "./account";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/account.ts src/lib/api/index.ts
git commit -m "feat: add deleteAccount client API module"
```

---

### Task 5: Delete Account Dialog

**Files:**
- Create: `src/components/settings/delete-account-dialog.tsx`

**Reference:** Follow the AlertDialog pattern from `src/components/dashboard/delete-project-button.tsx`. This dialog adds a "type DELETE to confirm" input guard.

- [ ] **Step 1: Create the confirmation dialog**

```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveSubscription: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  hasActiveSubscription,
}: DeleteAccountDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmation === "DELETE";

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Account deleted");
      await signOut({ redirectTo: "/" });
    } catch {
      toast.error("Failed to delete account");
      setDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) setConfirmation("");
    onOpenChange(open);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription render={<div className="space-y-3" />}>
              <p>
                This will permanently delete your account and all associated
                data including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>All projects and generated images</li>
                <li>Uploaded fonts and assets</li>
                <li>Style presets and attribute settings</li>
                <li>Credit balance and transaction history</li>
              </ul>
              <p className="font-medium text-destructive">
                This action cannot be undone.
              </p>
              {hasActiveSubscription && (
                <p className="rounded-md bg-destructive/10 p-3 text-destructive">
                  You have an active subscription. We will attempt to cancel it,
                  but please verify in your DodoPayments account that it has been
                  cancelled.
                </p>
              )}
              <p>
                Type <strong className="text-foreground">DELETE</strong> to
                confirm:
              </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Type DELETE to confirm"
          disabled={deleting}
          autoComplete="off"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmed || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Note: Uses `signOut` from `next-auth/react` (client-side) rather than the server action `signOut` from `@/lib/auth`. This is because we need to call the delete API first and then sign out — both from the client.

Note: Uses `AlertDialogDescription render={<div />}` (base-ui pattern) instead of Radix's `asChild` because the description content contains block elements (`<ul>`, `<p>`) that cannot live inside a `<p>` tag.

Note: Feedback images stored in R2 under `feedback/{userId}/` are not tracked in the database, so they are not cleaned up during account deletion. This is an accepted trade-off — these are small files and rare.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/delete-account-dialog.tsx
git commit -m "feat: add DeleteAccountDialog with type-to-confirm guard"
```

---

### Task 6: Settings General Tab — Danger Zone

**Files:**
- Modify: `src/app/settings/general-tab.tsx`

**Context:** Currently the General tab only has a "Show system prompt" toggle. Add a "Danger Zone" section below it with the delete account button. The dialog needs to know if the user has an active subscription, so add `subscriptionStatus` as a prop.

- [ ] **Step 1: Update GeneralTab to include Danger Zone**

Replace the entire `src/app/settings/general-tab.tsx` with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

interface GeneralTabProps {
  showPrompt: boolean;
  onShowPromptChange: (checked: boolean) => void;
  subscriptionStatus: string | null;
}

export function GeneralTab({
  showPrompt,
  onShowPromptChange,
  subscriptionStatus,
}: GeneralTabProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="show-prompt" className="text-sm font-medium">
            Show system prompt in generation history
          </Label>
          <p className="text-xs text-muted-foreground">
            Show the full AI system prompt alongside the user prompt. When off,
            system prompts can still be expanded per-generation.
          </p>
        </div>
        <Switch
          id="show-prompt"
          checked={showPrompt}
          onCheckedChange={onShowPromptChange}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Privacy</Label>
          <p className="text-xs text-muted-foreground">
            Read about how we handle your data.
          </p>
        </div>
        <Link
          href="/privacy"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Privacy Policy
        </Link>
      </div>

      <div className="rounded-lg border border-destructive/30 p-4">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This cannot be
          undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Account
        </Button>
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        hasActiveSubscription={subscriptionStatus === "ACTIVE"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Pass subscriptionStatus from SettingsClient**

In `src/app/settings/settings-client.tsx`:

1. Add state for `subscriptionStatus`:

After `const [showPrompt, setShowPrompt] = useState(false);` (line 54), add:
```tsx
const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
```

2. In the `init()` function, the `getPreferences()` call already fetches user preferences. We need to also fetch the subscription status. The billing API at `GET /api/credits` returns `subscriptionStatus`. Add to the imports:
```tsx
import { getCredits } from "@/lib/api";
```

Then in the `init()` function, add `getCredits()` to the `Promise.all`:
```tsx
const [configData, presetsData, fontsData, prefs, creditsData] = await Promise.all([
  getAttributeConfig(),
  getPresets(),
  listFonts(),
  getPreferences(),
  getCredits(),
]);
```

And after loading preferences:
```tsx
if (creditsData.subscriptionStatus) setSubscriptionStatus(creditsData.subscriptionStatus);
```

3. Pass it to GeneralTab:
```tsx
<GeneralTab
  showPrompt={showPrompt}
  onShowPromptChange={handleShowPromptChange}
  subscriptionStatus={subscriptionStatus}
/>
```

**Reference:** Check `src/lib/api/credits.ts` for the `getCredits()` function signature and return type to confirm `subscriptionStatus` is on the response.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/general-tab.tsx src/app/settings/settings-client.tsx
git commit -m "feat: add Danger Zone and privacy link to Settings General tab"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 2: Lint**

```bash
npx eslint src/app/privacy/ src/app/api/account/ src/lib/api/account.ts src/components/settings/delete-account-dialog.tsx src/app/settings/general-tab.tsx src/app/settings/settings-client.tsx src/app/page.tsx src/app/\(auth\)/sign-in/page.tsx
```
Expected: PASS (or fix any lint issues)

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`) and verify:
1. `/privacy` renders with all sections
2. Landing page footer has "Privacy" link
3. Sign-in page has "Privacy Policy" link
4. Settings General tab shows Privacy link and Danger Zone section
5. Delete Account button opens confirmation dialog
6. Dialog requires typing "DELETE" to enable the delete button
7. Cancel closes dialog and resets input
