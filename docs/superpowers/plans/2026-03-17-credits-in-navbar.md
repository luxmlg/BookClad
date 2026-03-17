# Credits in Navbar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user's credit balance in the navbar using a Zustand store, so it stays in sync with the editor toolbar after generation.

**Architecture:** A Zustand store (`credit-store.ts`) holds `balance` and a `refreshCredits()` action. A tiny `CreditHydrator` client component seeds the store from server-fetched data on mount. The navbar renders a `CreditPill` client component that reads from the store. The editor replaces its local `creditBalance` state with the same store, so both displays update together after generation.

**Tech Stack:** Zustand (new dependency), React, Next.js App Router (server components + client components)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Install | `zustand` | State management library |
| Create | `src/lib/stores/credit-store.ts` | Zustand store: `balance`, `setBalance()`, `refreshCredits()` |
| Create | `src/components/providers/credit-hydrator.tsx` | Client component that hydrates store from server data |
| Create | `src/components/layout/credit-pill.tsx` | Client component: Coins icon + balance pill, links to billing |
| Modify | `src/app/layout.tsx` | Fetch `creditBalance` server-side, render `<CreditHydrator>` |
| Modify | `src/components/layout/navbar.tsx` | Render `<CreditPill />` in desktop nav |
| Modify | `src/components/layout/mobile-nav.tsx` | Read from store, show balance in mobile sheet |
| Modify | `src/components/editor/editor-shell.tsx` | Replace local `creditBalance`/`setCreditBalance` with store |
| Modify | `src/components/editor/inpaint-toolbar.tsx` | Read `creditBalance` from store instead of props |

---

### Task 1: Install Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zustand**

```bash
npm install zustand
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('zustand')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand for client-side state management"
```

---

### Task 2: Create Credit Store

**Files:**
- Create: `src/lib/stores/credit-store.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from "zustand";
import { getCredits } from "@/lib/api/credits";

interface CreditState {
  balance: number;
  setBalance: (balance: number) => void;
  refreshCredits: () => Promise<void>;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  refreshCredits: async () => {
    try {
      const data = await getCredits();
      set({ balance: data.balance });
    } catch {
      // Silently fail — balance stays stale rather than breaking UI
    }
  },
}));
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/credit-store.ts
git commit -m "feat: add zustand credit store with balance and refresh action"
```

---

### Task 3: Create CreditHydrator and CreditPill Components

**Files:**
- Create: `src/components/providers/credit-hydrator.tsx`
- Create: `src/components/layout/credit-pill.tsx`

- [ ] **Step 1: Create CreditHydrator**

This component receives the server-fetched balance and seeds the Zustand store on mount. It renders nothing visible.

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useCreditStore } from "@/lib/stores/credit-store";

interface CreditHydratorProps {
  balance: number;
}

export function CreditHydrator({ balance }: CreditHydratorProps) {
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      useCreditStore.getState().setBalance(balance);
      hydrated.current = true;
    }
  }, [balance]);

  return null;
}
```

- [ ] **Step 2: Create CreditPill**

A small pill that shows the Coins icon + balance, links to the billing settings tab.

```typescript
"use client";

import Link from "next/link";
import { Coins } from "lucide-react";
import { useCreditStore } from "@/lib/stores/credit-store";

export function CreditPill() {
  const balance = useCreditStore((s) => s.balance);

  return (
    <Link
      href="/settings?tab=billing"
      className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1 text-sm font-medium transition-colors hover:bg-muted"
    >
      <Coins className="size-3.5 text-primary" />
      <span className="tabular-nums">{balance}</span>
    </Link>
  );
}
```

- [ ] **Step 3: Verify type-check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/credit-hydrator.tsx src/components/layout/credit-pill.tsx
git commit -m "feat: add CreditHydrator and CreditPill components"
```

---

### Task 4: Wire Into Layout and Navbar

**Files:**
- Modify: `src/app/layout.tsx` — Import `auth`, `prisma`, and `CreditHydrator`. Fetch `creditBalance` when authenticated. Render `<CreditHydrator>` inside `<Providers>`.
- Modify: `src/components/layout/navbar.tsx` — Import and render `<CreditPill />` between "My Covers" link and `<ThemeToggle />` in the authenticated desktop nav.
- Modify: `src/components/layout/mobile-nav.tsx` — Import `useCreditStore`, show balance in the mobile sheet nav for authenticated users.

- [ ] **Step 1: Update layout.tsx**

Add server-side credit balance fetch and hydrator:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditHydrator } from "@/components/providers/credit-hydrator";
```

Change `RootLayout` to async, fetch balance:

```typescript
export default async function RootLayout({ children }: ...) {
  const session = await auth();
  let creditBalance = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditBalance: true },
    });
    creditBalance = user?.creditBalance ?? 0;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body ...>
        <Providers>
          {session?.user && <CreditHydrator balance={creditBalance} />}
          <Navbar />
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update navbar.tsx**

Add import:
```typescript
import { CreditPill } from "./credit-pill";
```

In the authenticated desktop nav, between the "My Covers" link and `<ThemeToggle />`, add:
```tsx
<CreditPill />
```

- [ ] **Step 3: Update mobile-nav.tsx**

Add import:
```typescript
import { Coins } from "lucide-react";
import { useCreditStore } from "@/lib/stores/credit-store";
```

Inside the authenticated mobile nav section, add a credit display:
```tsx
<Link
  href="/settings?tab=billing"
  onClick={() => setOpen(false)}
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
>
  <Coins className="size-4 text-primary" />
  <span className="tabular-nums">{useCreditStore.getState().balance}</span>
  <span className="text-muted-foreground">credits</span>
</Link>
```

Note: In MobileNav, call `useCreditStore()` as a hook at the top of the component (not `.getState()` inline) so it re-renders when balance changes:

```typescript
export function MobileNav({ isAuthenticated }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const creditBalance = useCreditStore((s) => s.balance);
  // ...
}
```

- [ ] **Step 4: Verify type-check and lint**

```bash
npx tsc --noEmit && npm run lint 2>&1 | grep -E "(layout|navbar|mobile-nav)" | head -5
```

Expected: No errors in changed files

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/layout/navbar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: show credit balance in navbar and mobile nav"
```

---

### Task 5: Integrate Editor with Credit Store

**Files:**
- Modify: `src/components/editor/editor-shell.tsx` — Replace local `creditBalance`/`setCreditBalance` with Zustand store. Update `refreshCredits` to use store action. Remove `getCredits` fetch from init effect.
- Modify: `src/components/editor/inpaint-toolbar.tsx` — Read `creditBalance` from store instead of props.

- [ ] **Step 1: Update editor-shell.tsx**

Add import:
```typescript
import { useCreditStore } from "@/lib/stores/credit-store";
```

Replace line 95:
```typescript
// OLD: const [creditBalance, setCreditBalance] = useState(initialCreditBalance);
// NEW:
const creditBalance = useCreditStore((s) => s.balance);
const storeRefreshCredits = useCreditStore((s) => s.refreshCredits);
```

Replace the `refreshCredits` callback (lines 136-138):
```typescript
// OLD:
// const refreshCredits = useCallback(() => {
//   getCredits().then((c) => setCreditBalance(c.balance)).catch(() => {});
// }, []);

// NEW — use the store's refreshCredits directly:
const refreshCredits = storeRefreshCredits;
```

In the init `useEffect` (lines 191-222), remove the `getCredits()` call from `Promise.allSettled` and remove the `setCreditBalance` handler (results[5]). The store is already hydrated by `CreditHydrator` in the layout, and the editor can refresh via `refreshCredits()` after generation. The init effect should still call `refreshCredits()` to get the latest balance when entering the editor:

```typescript
useEffect(() => {
  async function init() {
    const results = await Promise.allSettled([
      getAttributeConfig(),
      getPresets(),
      getProjectAssets(project.id),
      listFonts(),
      getPreferences(),
    ]);
    // ... handle results[0] through results[4] (same as before, remove results[5])
    // Refresh credits from API to ensure latest balance
    storeRefreshCredits();
  }
  init();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Remove the `getCredits` import if no longer used elsewhere in the file.

Also remove `initialCreditBalance` from the component's props interface and from the page that passes it (check `src/app/editor/[id]/page.tsx`).

- [ ] **Step 2: Update inpaint-toolbar.tsx**

Add import:
```typescript
import { useCreditStore } from "@/lib/stores/credit-store";
```

Remove `creditBalance` from the `InpaintToolbarProps` interface (line 48).

At the top of the component, read from store:
```typescript
const creditBalance = useCreditStore((s) => s.balance);
```

Remove `creditBalance` from the destructured props (line 72).

- [ ] **Step 3: Update editor-shell.tsx prop passing**

Remove the `creditBalance={creditBalance}` prop from the `InpaintToolbar` usage (line 745).

- [ ] **Step 4: Update editor page**

In `src/app/editor/[id]/page.tsx`, remove the `creditBalance` fetch and the `initialCreditBalance` prop passed to `EditorShell`.

- [ ] **Step 5: Verify type-check and lint**

```bash
npx tsc --noEmit && npm run lint 2>&1 | grep -E "(editor-shell|inpaint-toolbar|page)" | head -5
```

Expected: No errors

- [ ] **Step 6: Test manually**

1. Open the editor at `/editor/[id]`
2. Verify credit balance shows in both navbar pill and editor toolbar
3. Trigger a generation
4. After completion, verify both navbar pill and toolbar update to the new balance

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/editor-shell.tsx src/components/editor/inpaint-toolbar.tsx src/app/editor/\[id\]/page.tsx
git commit -m "refactor: use zustand credit store in editor instead of local state"
```

---

## Verification

1. **Navbar pill visible**: Sign in → credit pill with Coins icon appears between "My Covers" and theme toggle
2. **Links to billing**: Click pill → navigates to `/settings?tab=billing`
3. **Mobile nav**: Open hamburger menu → credits shown in mobile sheet
4. **Not shown when logged out**: Visit landing page logged out → no credit pill
5. **Editor sync**: Open editor → generate → both navbar pill and toolbar balance update
6. **Page navigation**: Generate in editor → go to dashboard → navbar shows updated balance
7. **Dark mode**: Pill renders correctly in both light and dark themes
