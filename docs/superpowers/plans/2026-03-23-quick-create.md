# Quick Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simplified "Quick Create" flow that generates covers from just title, author, genre, and a description — using AI Fill behind the scenes to set attributes automatically.

**Architecture:** New `POST /api/projects/quick-create` endpoint orchestrates the full flow server-side: validates input, checks credits upfront, calls AI Fill to generate attributes, creates the project, reserves generation credits, and queues the BullMQ job. A new `QuickCreateForm` component replaces the default view on `/create`, with the existing `BriefWizard` accessible via a toggle link.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7, Zod, BullMQ, Gemini AI (via existing `generateAttributeSuggestions`)

**Spec:** `docs/superpowers/specs/2026-03-23-quick-create-design.md`

---

### Task 1: Database Migration — Add `description` to CoverProject

**Files:**
- Modify: `prisma/schema.prisma` (CoverProject model)
- Modify: `worker/prisma/schema.prisma` (CoverProject model)

- [ ] **Step 1: Add `description` column to app Prisma schema**

In `prisma/schema.prisma`, add `description String?` to the `CoverProject` model, after `author`:

```prisma
model CoverProject {
  id          String   @id @default(cuid())
  userId      String
  title       String
  author      String
  description String?
  attributes  Json
  canvasState Json?
  // ... rest unchanged
}
```

- [ ] **Step 2: Add `description` column to worker Prisma schema**

In `worker/prisma/schema.prisma`, make the same change to `CoverProject`:

```prisma
model CoverProject {
  id          String   @id @default(cuid())
  userId      String
  title       String
  author      String
  description String?
  attributes  Json
  canvasState Json?
  // ... rest unchanged
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name add-project-description`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Regenerate both Prisma clients**

Run: `npx prisma generate && cd worker && npx prisma generate`
Expected: Both clients regenerated without errors.

- [ ] **Step 5: Type-check both packages**

Run: `npx tsc --noEmit && cd worker && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/ worker/prisma/ src/generated/ worker/src/generated/
git commit -m "feat: add description column to CoverProject"
```

---

### Task 2: Add `QUICK_CREATE_TIER_CONFIG` Constant

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Add the tier config constant**

In `src/lib/constants.ts`, after the `TIER_CREDITS` constant (line 67), add:

```typescript
export const QUICK_CREATE_TIER_CONFIG = {
  FREE: { model: "quick", imageCount: 4 },
  STARTER: { model: "detailed", imageCount: 8 },
  PRO: { model: "premium", imageCount: 8 },
} as const;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add QUICK_CREATE_TIER_CONFIG constant"
```

---

### Task 3: Add `quickCreateSchema` to Validations

**Files:**
- Modify: `src/lib/validations.ts`

- [ ] **Step 1: Add the schema**

In `src/lib/validations.ts`, update the existing constants import to include `GENRES`:

```typescript
import { AI_MODELS, AI_FILL_PROMPT_MAX_LENGTH, MAX_IMAGES_PER_GENERATION, GENRES } from "./constants";
```

Then add the schema after the existing `aiFillSchema`:

```typescript
const genreValues = GENRES.map((g) => g.value) as [string, ...string[]];

export const quickCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  author: z.string().min(1, "Author name is required").max(200),
  genre: z.enum(genreValues),
  description: z.string().min(1, "Description is required").max(AI_FILL_PROMPT_MAX_LENGTH),
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations.ts
git commit -m "feat: add quickCreateSchema validation"
```

---

### Task 4: Extract `applySuggestions()` Utility

**Files:**
- Modify: `src/lib/ai-fill.ts`
- Modify: `src/components/editor/left-sidebar.tsx`

- [ ] **Step 1: Add `applySuggestions` to `src/lib/ai-fill.ts`**

Add this pure function to `src/lib/ai-fill.ts`. It encapsulates the logic currently inlined in `handleApplyAiFill` in `left-sidebar.tsx`. The existing import in `ai-fill.ts` is type-only — add a separate runtime import:

```typescript
import { slugify, addValueToAttribute } from "@/lib/attributes";
```

Then add the function:

```typescript
export function applySuggestions(
  config: AttributeConfigJson,
  baseSelection: AttributeSelection,
  suggestions: AiFillSuggestion[],
): { config: AttributeConfigJson; selection: AttributeSelection } {
  let updatedConfig = config;
  const updatedSelection = { ...baseSelection };

  for (const suggestion of suggestions) {
    const resolvedId =
      suggestion.isNew && suggestion.newAttribute
        ? slugify(suggestion.newAttribute.name)
        : suggestion.attributeId;

    if (!resolvedId) continue;

    const existingAttr = updatedConfig.attributes.find((a) => a.id === resolvedId);

    if (!existingAttr && suggestion.newAttribute) {
      const newAttr: Attribute = {
        id: resolvedId,
        name: suggestion.newAttribute.name,
        type: suggestion.newAttribute.type,
        builtIn: false,
        enabled: true,
        description: suggestion.newAttribute.description,
        values: (suggestion.newAttribute.values ?? []).map((v) => ({
          ...v,
          builtIn: false,
        })),
        scaleLabels: suggestion.newAttribute.scaleLabels,
      };
      updatedConfig = {
        attributes: [...updatedConfig.attributes, newAttr],
      };
    } else if (suggestion.newValues) {
      for (const nv of suggestion.newValues) {
        const attr = updatedConfig.attributes.find((a) => a.id === resolvedId);
        const alreadyExists = attr?.values.some((v) => v.value === nv.value);
        if (!alreadyExists) {
          updatedConfig = addValueToAttribute(
            updatedConfig,
            resolvedId,
            nv.value,
            nv.label,
            nv.description,
            nv.colors,
          );
        }
      }
    }

    updatedSelection[resolvedId] = suggestion.value;
  }

  return { config: updatedConfig, selection: updatedSelection };
}
```

- [ ] **Step 2: Refactor `handleApplyAiFill` in `left-sidebar.tsx` to use the new utility**

In `src/components/editor/left-sidebar.tsx`, replace the inline logic in `handleApplyAiFill` with a call to the extracted function. Add import:

```typescript
import { applySuggestions } from "@/lib/ai-fill";
```

Also remove `slugify` from the `@/lib/attributes` import — it is no longer used in this file after the extraction (its only usage was inside the extracted logic).

Then refactor `handleApplyAiFill`:

```typescript
function handleApplyAiFill(selected: AiFillSuggestion[]) {
  const { config: updatedConfig, selection: updatedAttrs } = applySuggestions(
    attributeConfig,
    attributes,
    selected,
  );

  onConfigChange(updatedConfig);
  setAttributes(updatedAttrs);
  onClearActivePreset();
  useCreditStore.getState().refreshCredits();
}
```

The function now delegates the config/selection logic to `applySuggestions` and only handles the UI-specific side effects (state updates, preset clearing, credit refresh).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Verify the dev server runs**

Run: `npm run dev` (briefly start and stop to verify no runtime errors)
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-fill.ts src/components/editor/left-sidebar.tsx
git commit -m "refactor: extract applySuggestions utility from left-sidebar"
```

---

### Task 5: Create `POST /api/projects/quick-create` Route

**Files:**
- Create: `src/app/api/projects/quick-create/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/projects/quick-create/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quickCreateSchema } from "@/lib/validations";
import {
  reserveAiFillCredits,
  reserveCredits,
  calculateCreditCost,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  generateAttributeSuggestions,
  applySuggestions,
} from "@/lib/ai-fill";
import {
  AI_FILL_CREDIT_COST,
  CREDIT_COST_PER_IMAGE,
  GENERATION_STATUS,
  JOB_TYPE,
  QUICK_CREATE_TIER_CONFIG,
} from "@/lib/constants";
import { getGenerationQueue } from "@/lib/queue";
import {
  buildDefaultConfig,
  buildDefaultSelection,
  ensureBuiltInAttributes,
} from "@/lib/attributes";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = quickCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { title, author, genre, description } = parsed.data;

    // Look up user tier
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { tier: true, creditBalance: true },
    });

    const tierConfig = QUICK_CREATE_TIER_CONFIG[user.tier];
    const { model, imageCount } = tierConfig;
    const generationCreditCost = calculateCreditCost(model, imageCount);
    const totalCost = AI_FILL_CREDIT_COST + generationCreditCost;

    // Upfront credit check
    if (user.creditBalance < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits: need ${totalCost}, have ${user.creditBalance}`,
          required: totalCost,
          available: user.creditBalance,
        },
        { status: 403 },
      );
    }

    // Reserve AI Fill credit
    await reserveAiFillCredits(session.user.id);

    // Fetch or create attribute config
    let configRecord = await prisma.attributeConfig.findUnique({
      where: { userId: session.user.id },
      select: { config: true },
    });

    let config: AttributeConfigJson;
    if (configRecord) {
      config = ensureBuiltInAttributes(
        configRecord.config as unknown as AttributeConfigJson,
      );
    } else {
      config = buildDefaultConfig();
      await prisma.attributeConfig.create({
        data: {
          userId: session.user.id,
          config: config as unknown as Record<string, unknown>,
        },
      });
    }

    // Build seed selection with genre pre-set
    const seedSelection = buildDefaultSelection(config);
    seedSelection.genre = genre;

    // Generate attributes via AI Fill
    const suggestions = await generateAttributeSuggestions(
      config,
      seedSelection,
      description,
    );

    // Apply suggestions
    const { config: finalConfig, selection: finalSelection } = applySuggestions(
      config,
      seedSelection,
      suggestions,
    );

    // Save updated config
    await prisma.attributeConfig.update({
      where: { userId: session.user.id },
      data: { config: finalConfig as unknown as Record<string, unknown> },
    });

    // Create project
    const project = await prisma.coverProject.create({
      data: {
        userId: session.user.id,
        title,
        author,
        description,
        attributes: finalSelection as unknown as Record<string, unknown>,
      },
    });

    // Reserve generation credits
    let generationId: string;
    try {
      const result = await reserveCredits(
        session.user.id,
        generationCreditCost,
        {
          projectId: project.id,
          prompt: "",
          status: GENERATION_STATUS.QUEUED,
          imageCount,
          jobType: JOB_TYPE.GENERATE,
          model,
          referenceImage: null,
          parentImageId: null,
          includeLayers: false,
          attributeSnapshot: finalSelection as unknown as Record<string, unknown>,
        },
      );
      generationId = result.generationId;
    } catch (err) {
      // Clean up orphaned project
      await prisma.coverProject.delete({ where: { id: project.id } });
      throw err;
    }

    // Enqueue job
    await getGenerationQueue().add(JOB_TYPE.GENERATE, {
      generationId,
      projectId: project.id,
      userId: session.user.id,
      imageCount,
      model,
      referenceImageKey: null,
      flattenedImageDataUrl: null,
      creditCost: generationCreditCost,
    });

    return NextResponse.json(
      { projectId: project.id, generationId },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: err.message, required: err.required, available: err.available },
        { status: 403 },
      );
    }
    console.error("[quick-create] Failed:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/quick-create/route.ts
git commit -m "feat: add POST /api/projects/quick-create endpoint"
```

---

### Task 6: Add Client API Module for Quick Create

**Files:**
- Create: `src/lib/api/quick-create.ts`
- Modify: `src/lib/api/index.ts`

- [ ] **Step 1: Create the client module**

Create `src/lib/api/quick-create.ts`:

```typescript
import api from "./client";

export interface QuickCreateParams {
  title: string;
  author: string;
  genre: string;
  description: string;
}

export interface QuickCreateResponse {
  projectId: string;
  generationId: string;
}

export async function quickCreate(
  params: QuickCreateParams,
): Promise<QuickCreateResponse> {
  const { data } = await api.post<QuickCreateResponse>(
    "/api/projects/quick-create",
    params,
  );
  return data;
}
```

- [ ] **Step 2: Add export to index**

In `src/lib/api/index.ts`, add:

```typescript
export * from "./quick-create";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/quick-create.ts src/lib/api/index.ts
git commit -m "feat: add quick-create client API module"
```

---

### Task 7: Create `QuickCreateForm` Component

**Files:**
- Create: `src/components/wizard/quick-create-form.tsx`

This component renders the simplified form with title, author, genre dropdown, and description textarea. It shows the credit cost based on the user's tier and handles submission + redirect.

- [ ] **Step 1: Create the component**

Create `src/components/wizard/quick-create-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  GENRES,
  AI_FILL_CREDIT_COST,
  CREDIT_COST_PER_IMAGE,
  QUICK_CREATE_TIER_CONFIG,
  AI_FILL_PROMPT_MAX_LENGTH,
} from "@/lib/constants";
import { quickCreate } from "@/lib/api";

interface QuickCreateFormProps {
  tier: string;
  creditBalance: number;
  onSwitchToAdvanced: () => void;
}

export function QuickCreateForm({
  tier,
  creditBalance,
  onSwitchToAdvanced,
}: QuickCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tierConfig = QUICK_CREATE_TIER_CONFIG[tier as keyof typeof QUICK_CREATE_TIER_CONFIG]
    ?? QUICK_CREATE_TIER_CONFIG.FREE;
  const generationCost = tierConfig.imageCount * CREDIT_COST_PER_IMAGE[tierConfig.model];
  const totalCost = AI_FILL_CREDIT_COST + generationCost;
  const canAfford = creditBalance >= totalCost;
  const isValid = title.trim() && author.trim() && genre && description.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !canAfford || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { projectId } = await quickCreate({
        title: title.trim(),
        author: author.trim(),
        genre,
        description: description.trim(),
      });
      router.push(`/editor/${projectId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Book Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The Great Adventure"
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="author">Author Name</Label>
        <Input
          id="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Jane Smith"
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="genre">Genre</Label>
        <Select value={genre} onValueChange={setGenre} disabled={isSubmitting}>
          <SelectTrigger id="genre">
            <SelectValue>
              {genre
                ? GENRES.find((g) => g.value === genre)?.label ?? genre
                : "Select a genre"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GENRES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Describe Your Ideal Cover</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A dark, moody cover with a shadowy figure standing in a rain-soaked alley. Neon signs reflecting off wet pavement. Cinematic and atmospheric."
          rows={4}
          maxLength={AI_FILL_PROMPT_MAX_LENGTH}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/{AI_FILL_PROMPT_MAX_LENGTH}
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={!isValid || !canAfford || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating your covers...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Covers
          </>
        )}
      </Button>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          {canAfford ? (
            <>
              This will use <strong>{totalCost} credits</strong>{" "}
              ({tierConfig.imageCount} {tierConfig.model} images + AI suggestions)
            </>
          ) : (
            <span className="text-destructive">
              Not enough credits — need {totalCost}, you have {creditBalance}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onSwitchToAdvanced}
          className="text-sm text-muted-foreground underline hover:text-foreground"
          disabled={isSubmitting}
        >
          or customize attributes manually &rarr;
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/quick-create-form.tsx
git commit -m "feat: add QuickCreateForm component"
```

---

### Task 8: Update `/create` Page to Toggle Between Quick Create and Advanced

**Files:**
- Modify: `src/app/create/page.tsx`

- [ ] **Step 1: Update the create page**

The page needs to:
1. Fetch the user's tier and credit balance (server-side)
2. Pass them to a new client wrapper component that toggles between `QuickCreateForm` and `BriefWizard`

Replace the contents of `src/app/create/page.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreatePageClient } from "@/components/wizard/create-page-client";

export default async function CreatePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tier: true, creditBalance: true },
  });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Create a New Cover</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your book and we&apos;ll generate cover options for you.
        </p>
      </div>
      <CreatePageClient tier={user.tier} creditBalance={user.creditBalance} />
    </div>
  );
}
```

- [ ] **Step 2: Create the client toggle wrapper**

Create `src/components/wizard/create-page-client.tsx`:

```typescript
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { QuickCreateForm } from "./quick-create-form";
import { BriefWizard } from "./brief-wizard";

interface CreatePageClientProps {
  tier: string;
  creditBalance: number;
}

export function CreatePageClient({ tier, creditBalance }: CreatePageClientProps) {
  const [mode, setMode] = useState<"quick" | "advanced">("quick");

  if (mode === "advanced") {
    return (
      <div>
        <button
          onClick={() => setMode("quick")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quick Create
        </button>
        <BriefWizard />
      </div>
    );
  }

  return (
    <QuickCreateForm
      tier={tier}
      creditBalance={creditBalance}
      onSwitchToAdvanced={() => setMode("advanced")}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Verify dev server renders both modes**

Run: `npm run dev`, navigate to `http://localhost:3000/create`.
Expected:
- Quick Create form is shown by default (title, author, genre, description fields)
- Clicking "customize attributes manually" switches to the existing wizard
- Clicking "Back to Quick Create" returns to the simple form

- [ ] **Step 5: Commit**

```bash
git add src/app/create/page.tsx src/components/wizard/create-page-client.tsx
git commit -m "feat: update /create page with Quick Create default and Advanced toggle"
```

---

### Task 9: End-to-End Verification

**Files:** None (verification only)

- [ ] **Step 1: Start infrastructure**

Run: `docker compose up -d postgres redis`
Expected: Postgres and Redis containers running.

- [ ] **Step 2: Start dev servers**

Run (in parallel terminals): `npm run dev` and `npm run dev:worker`
Expected: Next.js on port 3000, worker on port 4000.

- [ ] **Step 3: Test Quick Create flow**

1. Navigate to `http://localhost:3000/create`
2. Fill in: Title = "The Shadow Protocol", Author = "Alex Cross", Genre = "Thriller / Mystery", Description = "A dark, cinematic cover with a lone figure silhouetted against city lights. Rain-soaked streets, neon reflections, noir atmosphere."
3. Click "Generate Covers"
4. Verify: button shows "Creating your covers..." spinner
5. Verify: redirect to `/editor/[id]` occurs after a few seconds
6. Verify: images start appearing in the editor via WebSocket
7. Verify: attributes in the left sidebar are populated (genre should be thriller, other attributes AI-generated)

- [ ] **Step 4: Test insufficient credits**

1. Create a user with very few credits (e.g., 2)
2. Navigate to `/create`
3. Verify: credit cost display shows "Not enough credits"
4. Verify: Generate button is disabled

- [ ] **Step 5: Test Advanced wizard toggle**

1. Click "customize attributes manually"
2. Verify: full 4-step wizard appears
3. Click "Back to Quick Create"
4. Verify: form state is preserved (fields still filled in)
5. Complete a project through the advanced wizard
6. Verify: it still works as before (user can pick model + image count)

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 7: Final type-check**

Run: `npx tsc --noEmit && cd worker && npx tsc --noEmit`
Expected: No type errors in either package.
