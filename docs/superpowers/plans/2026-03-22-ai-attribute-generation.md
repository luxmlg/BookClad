# AI Attribute Generation ("AI Fill") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered "AI Fill" button to the editor sidebar that generates attribute suggestions via Gemini and lets users review/apply them.

**Architecture:** Synchronous `POST /api/attributes/generate` route in Next.js calls Gemini `gemini-2.5-flash` with the user's full attribute config + current selections + user direction. Returns structured JSON suggestions displayed in a review dialog. Costs 1 credit per call.

**Tech Stack:** Next.js 16 API routes, Gemini API (fetch), Prisma 7, React 19, shadcn/ui + base-ui, Zustand (credit store), Zod validation

**Spec:** `docs/superpowers/specs/2026-03-22-ai-attribute-generation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/ai-fill.ts` | Types (`AiFillSuggestion`), prompt building (`buildAiFillPrompt`), Gemini API call (`generateAttributeSuggestions`), response Zod schema |
| `src/lib/api/ai-fill.ts` | Client-side API module (`generateAttributes(projectId, prompt)`) |
| `src/app/api/attributes/generate/route.ts` | API endpoint: auth, validation, credit deduction, call Gemini, return suggestions |
| `src/components/editor/ai-fill-popover.tsx` | Popover with textarea + generate button, loading state |
| `src/components/editor/ai-fill-review-dialog.tsx` | Checklist dialog showing suggestions with toggles, apply/cancel/regenerate |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `AI_FILL_CREDIT_COST`, `AI_FILL_PROMPT_MAX_LENGTH` |
| `src/lib/validations.ts` | Add `aiFillSchema` Zod schema |
| `src/lib/credits.ts` | Add `reserveAiFillCredits()` function |
| `src/components/editor/left-sidebar.tsx` | Add AI Fill button, wire up popover + review dialog state |

---

## Task 1: Constants and Validation Schema

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/validations.ts`

- [ ] **Step 1: Add constants to `src/lib/constants.ts`**

Add after the `CREDIT_COST_PER_IMAGE` block (around line 58):

```typescript
export const AI_FILL_CREDIT_COST = 1;
export const AI_FILL_PROMPT_MAX_LENGTH = 1000;
```

- [ ] **Step 2: Add Zod schema to `src/lib/validations.ts`**

Add at the bottom of the file:

```typescript
import { AI_FILL_PROMPT_MAX_LENGTH } from "@/lib/constants";

export const aiFillSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  prompt: z.string().min(1).max(AI_FILL_PROMPT_MAX_LENGTH),
});
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/validations.ts
git commit -m "feat(ai-fill): add constants and validation schema"
```

---

## Task 2: Credit Reservation Helper

**Files:**
- Modify: `src/lib/credits.ts`

- [ ] **Step 1: Add `reserveAiFillCredits()` to `src/lib/credits.ts`**

Add after the existing `reserveExtensionCredits()` function. Follow the same Prisma `$transaction` pattern as `reserveCredits()` but without creating a `Generation` record. The `generationId` on `CreditTransaction` is left `null` intentionally.

```typescript
export async function reserveAiFillCredits(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });

    if (user.creditBalance < AI_FILL_CREDIT_COST) {
      throw new InsufficientCreditsError(AI_FILL_CREDIT_COST, user.creditBalance);
    }

    const newBalance = user.creditBalance - AI_FILL_CREDIT_COST;

    await tx.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "RESERVE",
        amount: -AI_FILL_CREDIT_COST,
        balanceAfter: newBalance,
        description: "AI attribute generation",
      },
    });
  });
}
```

Make sure to add `AI_FILL_CREDIT_COST` to the import from `@/lib/constants` at the top of the file.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/credits.ts
git commit -m "feat(ai-fill): add reserveAiFillCredits credit helper"
```

---

## Task 3: Core AI Fill Logic (Prompt Building + Gemini Call)

**Files:**
- Create: `src/lib/ai-fill.ts`

This is the core module. It contains: the `AiFillSuggestion` type, the prompt builder that serializes the user's full attribute config, and the Gemini API call with response validation.

- [ ] **Step 1: Create `src/lib/ai-fill.ts`**

```typescript
import { z } from "zod";
import type { AttributeConfigJson, AttributeSelection, Attribute } from "@/lib/attributes";

// --- Types ---

export interface AiFillSuggestion {
  attributeId: string | null;
  name: string;
  type: Attribute["type"];
  value: string | string[];
  previousValue?: string | string[];
  isNew: boolean;
  newValues?: { value: string; label: string; description?: string; colors?: string[] }[];
  newAttribute?: {
    name: string;
    type: Attribute["type"];
    description: string;
    values?: { value: string; label: string; description?: string; colors?: string[] }[];
    scaleLabels?: { min: string; max: string };
  };
}

// --- Response validation ---

const suggestionSchema = z.object({
  attributeId: z.string().nullable(),
  name: z.string(),
  type: z.enum(["single", "multi", "text", "toggle", "scale", "color", "palette"]),
  value: z.union([z.string(), z.array(z.string())]),
  isNew: z.boolean(),
  newValues: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        description: z.string().optional(),
        colors: z.array(z.string()).optional(),
      })
    )
    .optional(),
  newAttribute: z
    .object({
      name: z.string(),
      type: z.enum(["single", "multi", "text", "toggle", "scale", "color", "palette"]),
      description: z.string(),
      values: z
        .array(
          z.object({
            value: z.string(),
            label: z.string(),
            description: z.string().optional(),
            colors: z.array(z.string()).optional(),
          })
        )
        .optional(),
      scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
    })
    .optional(),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema),
});

// --- Prompt building ---

function serializeAttributeConfig(
  config: AttributeConfigJson,
  selections: AttributeSelection
): string {
  const lines: string[] = ["Available attributes:"];

  for (const attr of config.attributes) {
    lines.push("");
    lines.push(`${attr.name} (${attr.type}): ${attr.description ?? "No description"}`);

    if (attr.values.length > 0) {
      const valueDescs = attr.values.map((v) => {
        let desc = `${v.label}`;
        if (v.description) desc += ` — "${v.description}"`;
        if (v.colors?.length) desc += ` [colors: ${v.colors.join(", ")}]`;
        return `    - ${v.value}: ${desc}`;
      });
      lines.push("  Values:");
      lines.push(...valueDescs);
    }

    if (attr.scaleLabels) {
      lines.push(`  Scale: ${attr.scaleLabels.min} (0) to ${attr.scaleLabels.max} (10)`);
    }

    const selected = selections[attr.id];
    if (selected !== undefined) {
      const display = Array.isArray(selected) ? selected.join(", ") : selected;
      lines.push(`  Currently selected: ${display}`);
    } else {
      lines.push("  Currently: not set");
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are a book cover design attribute advisor. Your job is to suggest attribute values for an ebook cover based on the user's description and direction.

You will receive:
1. The user's full attribute configuration with all available attributes and their values
2. The user's current selections
3. The user's direction for what they want to change or improve

Attribute types and how to use them:
- "single": Pick exactly one value from the available options (or suggest a new one)
- "multi": Pick one or more values as tags (or suggest new ones)
- "text": Free-form text content (write descriptive content)
- "toggle": On/off switch — use "true" or "false"
- "scale": A number from 0 to 10
- "color": A hex color value like "#3b82f6"
- "palette": A curated color set — pick from available palettes or suggest new ones with color arrays

Rules:
- Only suggest changes that are RELEVANT to the user's direction. Do not change attributes that don't need changing.
- For existing attributes with predefined values, prefer picking from existing values. Only create new values when nothing existing fits.
- When creating new values, provide a slug-style value, a human-readable label, and optionally a description.
- When suggesting entirely new attributes, pick the most appropriate type and provide a full definition.
- Keep new attribute suggestions practical — only suggest attributes that would meaningfully impact the cover design.
- For multi-type attributes, you can suggest a complete replacement set or add to existing selections as appropriate.

Respond with valid JSON matching this exact structure:
{
  "suggestions": [
    {
      "attributeId": "existing-attr-id or null for new",
      "name": "Attribute Name",
      "type": "single|multi|text|toggle|scale|color|palette",
      "value": "selected-value" or ["value1", "value2"],
      "isNew": false,
      "newValues": [{"value": "slug", "label": "Label", "description": "optional desc"}]
    }
  ]
}

Set "isNew": true and include "newAttribute" only for brand new attributes not in the current config.
Set "newValues" only when you need to add values that don't exist in the attribute's current value list.
Include "attributeId" for existing attributes (use the exact id from the config), set to null for new ones.`;

export function buildAiFillPrompt(
  config: AttributeConfigJson,
  selections: AttributeSelection,
  userDirection: string
): string {
  const context = serializeAttributeConfig(config, selections);
  return `${context}\n\n---\n\nUser's direction: ${userDirection}`;
}

// --- Gemini API call ---

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash";
const FETCH_TIMEOUT_MS = 30_000;

export async function generateAttributeSuggestions(
  config: AttributeConfigJson,
  selections: AttributeSelection,
  userDirection: string
): Promise<AiFillSuggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const userPrompt = buildAiFillPrompt(config, selections, userDirection);

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: undefined,
      thinkingConfig: { thinkingBudget: 2048 },
    },
  };

  const res = await fetch(
    `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`[ai-fill] Gemini HTTP ${res.status}:`, errorBody);
    throw new Error(
      res.status === 429
        ? "Rate limited — please try again in a moment"
        : "Failed to generate attribute suggestions"
    );
  }

  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.find(
    (p: Record<string, unknown>) => typeof p.text === "string"
  );

  if (!textPart?.text) {
    throw new Error("No response from AI model");
  }

  // Parse the JSON from the model's text response
  let parsed: unknown;
  try {
    parsed = JSON.parse(textPart.text);
  } catch {
    console.error("[ai-fill] Failed to parse Gemini JSON:", textPart.text);
    throw new Error("AI returned invalid response — please try again");
  }

  // Validate against our schema
  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[ai-fill] Response validation failed:", result.error.issues);
    throw new Error("AI returned unexpected format — please try again");
  }

  // Attach previousValue for diff display
  const suggestions: AiFillSuggestion[] = result.data.suggestions.map((s) => ({
    ...s,
    previousValue: s.attributeId ? selections[s.attributeId] : undefined,
  }));

  return suggestions;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai-fill.ts
git commit -m "feat(ai-fill): add prompt building and Gemini API call"
```

---

## Task 4: API Route

**Files:**
- Create: `src/app/api/attributes/generate/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiFillSchema } from "@/lib/validations";
import { reserveAiFillCredits, InsufficientCreditsError } from "@/lib/credits";
import { generateAttributeSuggestions } from "@/lib/ai-fill";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = aiFillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { projectId, prompt } = parsed.data;

  // Verify project belongs to user
  const project = await prisma.coverProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { attributes: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch user's attribute config
  const configRecord = await prisma.attributeConfig.findUnique({
    where: { userId: session.user.id },
    select: { config: true },
  });

  if (!configRecord) {
    return NextResponse.json(
      { error: "Attribute config not found" },
      { status: 404 }
    );
  }

  // Reserve credits
  try {
    await reserveAiFillCredits(session.user.id);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: `Insufficient credits: need ${err.required}, have ${err.available}` },
        { status: 403 }
      );
    }
    throw err;
  }

  // Generate suggestions
  try {
    const config = configRecord.config as AttributeConfigJson;
    const selections = (project.attributes ?? {}) as AttributeSelection;

    const suggestions = await generateAttributeSuggestions(config, selections, prompt);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[ai-fill] Generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/attributes/generate/route.ts
git commit -m "feat(ai-fill): add POST /api/attributes/generate endpoint"
```

---

## Task 5: Client API Module

**Files:**
- Create: `src/lib/api/ai-fill.ts`

- [ ] **Step 1: Create the client API module**

Follow the pattern from other modules in `src/lib/api/` (e.g., `generations.ts`, `credits.ts`):

```typescript
import api from "./client";
import type { AiFillSuggestion } from "@/lib/ai-fill";

interface GenerateAttributesResponse {
  suggestions: AiFillSuggestion[];
}

export async function generateAttributes(
  projectId: string,
  prompt: string
): Promise<AiFillSuggestion[]> {
  const { data } = await api.post<GenerateAttributesResponse>(
    "/api/attributes/generate",
    { projectId, prompt }
  );
  return data.suggestions;
}
```

- [ ] **Step 2: Export from `src/lib/api/index.ts`**

Add `export * from "./ai-fill"` to the barrel export file at `src/lib/api/index.ts`.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/ai-fill.ts
git commit -m "feat(ai-fill): add client API module"
```

---

## Task 6: AI Fill Popover Component

**Files:**
- Create: `src/components/editor/ai-fill-popover.tsx`

- [ ] **Step 1: Create the popover component**

Uses `@base-ui/react/popover` directly, following the pattern in `src/components/add-value-popover.tsx`. The popover's `open` state is controlled by the parent so the Regenerate flow can re-open it.

```typescript
"use client";

import { useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAttributes } from "@/lib/api/ai-fill";
import { useCreditStore } from "@/lib/stores/credit-store";
import { AI_FILL_CREDIT_COST, AI_FILL_PROMPT_MAX_LENGTH } from "@/lib/constants";
import type { AiFillSuggestion } from "@/lib/ai-fill";

interface AiFillPopoverProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onSuggestions: (suggestions: AiFillSuggestion[]) => void;
}

export function AiFillPopover({
  projectId,
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  loading,
  onLoadingChange,
  onSuggestions,
}: AiFillPopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const balance = useCreditStore((s) => s.balance);

  const canGenerate =
    prompt.trim().length > 0 &&
    balance >= AI_FILL_CREDIT_COST &&
    !loading;

  async function handleGenerate() {
    if (!canGenerate) return;
    onLoadingChange(true);
    try {
      const suggestions = await generateAttributes(projectId, prompt.trim());
      onOpenChange(false);
      onSuggestions(suggestions);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate suggestions";
      toast.error(message);
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <>
      <div ref={anchorRef}>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-purple-500/30 bg-purple-500/5 text-xs text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
          onClick={() => onOpenChange(true)}
        >
          <Sparkles className="size-3.5" />
          AI Fill
        </Button>
      </div>
      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="bottom"
            sideOffset={4}
            align="start"
          >
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md">
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">AI Attribute Fill</h4>
                  <p className="text-xs text-muted-foreground">
                    Describe what you want and AI will suggest attribute values
                  </p>
                </div>
                <textarea
                  placeholder="e.g. Make it a dark horror novel set in an abandoned asylum..."
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  maxLength={AI_FILL_PROMPT_MAX_LENGTH}
                  rows={3}
                  disabled={loading}
                  className="flex w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {prompt.length}/{AI_FILL_PROMPT_MAX_LENGTH}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="gap-1.5"
                  >
                    {loading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    Generate ({AI_FILL_CREDIT_COST} credit)
                  </Button>
                </div>
                {balance < AI_FILL_CREDIT_COST && (
                  <p className="text-xs text-destructive">
                    Insufficient credits ({balance} available)
                  </p>
                )}
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/ai-fill-popover.tsx
git commit -m "feat(ai-fill): add AiFillPopover component"
```

---

## Task 7: AI Fill Review Dialog Component

**Files:**
- Create: `src/components/editor/ai-fill-review-dialog.tsx`

- [ ] **Step 1: Create the review dialog component**

Uses shadcn `Dialog` with base-ui primitives. Uses native checkbox input styled with Tailwind (no Checkbox UI component exists in this codebase). Uses render-time state reset pattern (not `useEffect`) following `add-value-popover.tsx`.

```typescript
"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatAttrValue } from "@/lib/attributes";
import type { AiFillSuggestion } from "@/lib/ai-fill";

interface AiFillReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AiFillSuggestion[];
  onApply: (selected: AiFillSuggestion[]) => void;
  onRegenerate: () => void;
}

export function AiFillReviewDialog({
  open,
  onOpenChange,
  suggestions,
  onApply,
  onRegenerate,
}: AiFillReviewDialogProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(suggestions.map((_, i) => i))
  );

  // Reset checked state when suggestions change (render-time pattern, not useEffect)
  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);
  if (suggestions !== prevSuggestions) {
    setPrevSuggestions(suggestions);
    setChecked(new Set(suggestions.map((_, i) => i)));
  }

  const updated = suggestions.filter((s) => !s.isNew);
  const newAttrs = suggestions.filter((s) => s.isNew);

  function toggleItem(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleApply() {
    const selected = suggestions.filter((_, i) => checked.has(i));
    onApply(selected);
    onOpenChange(false);
  }

  function handleRegenerate() {
    onOpenChange(false);
    onRegenerate();
  }

  const selectedCount = checked.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-400" />
            AI Attribute Suggestions
          </DialogTitle>
          <DialogDescription>
            Review and select which suggestions to apply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {updated.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Updated attributes
              </p>
              <div className="space-y-1">
                {updated.map((s) => {
                  const globalIndex = suggestions.indexOf(s);
                  return (
                    <SuggestionRow
                      key={globalIndex}
                      suggestion={s}
                      checked={checked.has(globalIndex)}
                      onToggle={() => toggleItem(globalIndex)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {newAttrs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                New attributes suggested
              </p>
              <div className="space-y-1">
                {newAttrs.map((s) => {
                  const globalIndex = suggestions.indexOf(s);
                  return (
                    <SuggestionRow
                      key={globalIndex}
                      suggestion={s}
                      checked={checked.has(globalIndex)}
                      onToggle={() => toggleItem(globalIndex)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            Regenerate
          </Button>
          <Button size="sm" onClick={handleApply} disabled={selectedCount === 0}>
            Apply {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Suggestion row sub-component ---

interface SuggestionRowProps {
  suggestion: AiFillSuggestion;
  checked: boolean;
  onToggle: () => void;
}

function SuggestionRow({ suggestion, checked, onToggle }: SuggestionRowProps) {
  const displayValue = formatAttrValue(suggestion.value);
  const displayPrevious = suggestion.previousValue
    ? formatAttrValue(suggestion.previousValue)
    : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50 ${
        checked ? "border-border bg-accent/30" : "border-transparent"
      }`}
    >
      <div
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30"
        }`}
      >
        {checked && <Check className="size-3" />}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{suggestion.name}</span>
          {suggestion.isNew && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0">
              NEW
            </Badge>
          )}
          {suggestion.newValues && suggestion.newValues.length > 0 && !suggestion.isNew && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px] px-1.5 py-0">
              +{suggestion.newValues.length} new
            </Badge>
          )}
        </div>
        <p className="text-xs text-foreground">{displayValue}</p>
        {displayPrevious && (
          <p className="text-xs text-muted-foreground">
            was: {displayPrevious}
          </p>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/ai-fill-review-dialog.tsx
git commit -m "feat(ai-fill): add AiFillReviewDialog component"
```

---

## Task 8: Wire Up Left Sidebar + Integration

**Files:**
- Modify: `src/components/editor/left-sidebar.tsx`

This is the integration task. Add the AI Fill button, manage popover/dialog state, and wire the apply callback to update attributes and config.

- [ ] **Step 1: Add imports to `left-sidebar.tsx`**

Add these imports at the top of the file:

```typescript
import { AiFillPopover } from "./ai-fill-popover";
import { AiFillReviewDialog } from "./ai-fill-review-dialog";
import { slugify, getDefaultValue } from "@/lib/attributes";
import { useCreditStore } from "@/lib/stores/credit-store";
import type { AiFillSuggestion } from "@/lib/ai-fill";
```

Note: `slugify` and `getDefaultValue` may already be imported — check and don't duplicate. Also check if `useCreditStore` is already imported.

- [ ] **Step 2: Add state and handler inside the `LeftSidebar` component**

Add state for the AI fill flow (after existing state declarations):

```typescript
const [aiFillPrompt, setAiFillPrompt] = useState("");
const [aiFillSuggestions, setAiFillSuggestions] = useState<AiFillSuggestion[]>([]);
const [reviewOpen, setReviewOpen] = useState(false);
const [popoverOpen, setPopoverOpen] = useState(false);
const [aiFillLoading, setAiFillLoading] = useState(false);
```

Add the handler that receives suggestions from the popover:

```typescript
function handleAiFillSuggestions(suggestions: AiFillSuggestion[]) {
  setAiFillSuggestions(suggestions);
  setReviewOpen(true);
}
```

Add the handler that applies selected suggestions:

```typescript
function handleApplyAiFill(selected: AiFillSuggestion[]) {
  let updatedConfig = attributeConfig;
  const updatedAttrs = { ...attributes };

  for (const suggestion of selected) {
    if (suggestion.isNew && suggestion.newAttribute) {
      // Add brand new attribute to config
      const newId = slugify(suggestion.newAttribute.name);
      const newAttr = {
        id: newId,
        name: suggestion.newAttribute.name,
        type: suggestion.newAttribute.type,
        builtIn: false,
        enabled: true,
        description: suggestion.newAttribute.description,
        values: (suggestion.newAttribute.values ?? []).map((v) => ({ ...v, builtIn: false })),
        scaleLabels: suggestion.newAttribute.scaleLabels,
      };
      updatedConfig = {
        attributes: [...updatedConfig.attributes, newAttr],
      };
      updatedAttrs[newId] = suggestion.value;
    } else if (suggestion.attributeId) {
      // Update existing attribute value
      if (suggestion.newValues) {
        // Add new values to the attribute config first
        for (const nv of suggestion.newValues) {
          updatedConfig = addValueToAttribute(
            updatedConfig,
            suggestion.attributeId,
            nv.value,
            nv.label,
            nv.description,
            nv.colors
          );
        }
      }
      updatedAttrs[suggestion.attributeId] = suggestion.value;
    }
  }

  onConfigChange(updatedConfig);
  setAttributes(updatedAttrs);
  onClearActivePreset();
  useCreditStore.getState().refreshCredits();
}
```

Add the regenerate handler (opens the popover with the same prompt):

```typescript
function handleAiFillRegenerate() {
  setPopoverOpen(true);
}
```

- [ ] **Step 3: Update the "Add Attribute" button area in JSX**

Find the existing button (around line 298-306) and wrap it in a flex container alongside the AI Fill popover:

Replace:
```tsx
<Button
  variant="outline"
  size="sm"
  className="w-full gap-1.5 border-dashed text-xs"
  onClick={() => setPickerOpen(true)}
>
  <PlusIcon className="size-3.5" />
  Add Attribute
</Button>
```

With:
```tsx
<div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    className="flex-1 gap-1.5 border-dashed text-xs"
    onClick={() => setPickerOpen(true)}
  >
    <PlusIcon className="size-3.5" />
    Add Attribute
  </Button>
  <div className="flex-1">
    <AiFillPopover
      projectId={projectId}
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      prompt={aiFillPrompt}
      onPromptChange={setAiFillPrompt}
      loading={aiFillLoading}
      onLoadingChange={setAiFillLoading}
      onSuggestions={handleAiFillSuggestions}
    />
  </div>
</div>
```

**Important:** The `LeftSidebar` doesn't currently receive `projectId` as a prop. Check `LeftSidebarProps` — you'll need to add `projectId: string` to the props interface and pass it from `EditorShell` (which has it as `project.id`).

- [ ] **Step 4: Add the review dialog at the bottom of the JSX (sibling to other dialogs)**

Add after the existing `CreateAttributeDialog`:

```tsx
<AiFillReviewDialog
  open={reviewOpen}
  onOpenChange={setReviewOpen}
  suggestions={aiFillSuggestions}
  onApply={handleApplyAiFill}
  onRegenerate={handleAiFillRegenerate}
/>
```

- [ ] **Step 5: Add `projectId` prop to `LeftSidebarProps` and pass from EditorShell**

In `left-sidebar.tsx`, add to the props interface:
```typescript
projectId: string;
```

In `editor-shell.tsx`, add the prop to the `<LeftSidebar>` usage:
```tsx
<LeftSidebar
  projectId={project.id}
  // ... existing props
/>
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Manual test**

1. Start dev server: `npm run dev`
2. Open the editor for a project
3. Verify the "AI Fill" button appears next to "Add Attribute" with purple styling
4. Click the button — popover opens with textarea
5. Type a direction and click Generate
6. Verify the review dialog opens with suggestions
7. Toggle checkboxes, click Apply
8. Verify attributes update in the sidebar
9. Verify credit balance updates in the navbar

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/left-sidebar.tsx src/components/editor/editor-shell.tsx
git commit -m "feat(ai-fill): wire up AI Fill button and review dialog in sidebar"
```
