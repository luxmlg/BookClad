# AI Edit Attributes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered natural language editing of attribute configs in Settings, allow deleting built-in attributes, and add a restore button.

**Architecture:** New API endpoint calls Gemini with the user's full attribute config + natural language instruction, gets back a modified config. Client diffs before/after and shows a review dialog. Reuses existing patterns from AI Fill (popover, credit reservation, Gemini call).

**Tech Stack:** Next.js API route, Gemini 2.5 Flash, Zod validation, React (shadcn/ui components)

**Spec:** `docs/superpowers/specs/2026-03-26-ai-edit-attributes-design.md`

---

### Task 1: Attribute Diff Engine

**Files:**
- Create: `src/lib/attribute-diff.ts`

This is the core logic — pure functions with no UI or API dependencies. Must be done first since the API response processing and review dialog both depend on it.

- [ ] **Step 1: Create `src/lib/attribute-diff.ts` with types and `diffAttributeConfigs`**

```typescript
import type { Attribute, AttributeValue, AttributeConfigJson } from "./attributes";

// ── Change types ────────────────────────────────────────

export type ConfigChange =
  | { type: "add-attribute"; attribute: Attribute }
  | { type: "remove-attribute"; attribute: Attribute }
  | { type: "modify-attribute"; attributeId: string; attributeName: string; field: string; before: string; after: string }
  | { type: "add-value"; attributeId: string; attributeName: string; value: AttributeValue }
  | { type: "remove-value"; attributeId: string; attributeName: string; value: AttributeValue }
  | { type: "modify-value"; attributeId: string; attributeName: string; valueBefore: AttributeValue; valueAfter: AttributeValue };

// ── Diff ────────────────────────────────────────────────

export function diffAttributeConfigs(
  before: AttributeConfigJson,
  after: AttributeConfigJson,
): ConfigChange[] {
  const changes: ConfigChange[] = [];
  const beforeMap = new Map(before.attributes.map((a) => [a.id, a]));
  const afterMap = new Map(after.attributes.map((a) => [a.id, a]));

  // Removed attributes
  for (const attr of before.attributes) {
    if (!afterMap.has(attr.id)) {
      changes.push({ type: "remove-attribute", attribute: attr });
    }
  }

  // Added attributes
  for (const attr of after.attributes) {
    if (!beforeMap.has(attr.id)) {
      changes.push({ type: "add-attribute", attribute: attr });
    }
  }

  // Modified attributes
  for (const afterAttr of after.attributes) {
    const beforeAttr = beforeMap.get(afterAttr.id);
    if (!beforeAttr) continue;

    // Field-level changes
    for (const field of ["name", "type", "description", "enabled"] as const) {
      const bVal = String(beforeAttr[field] ?? "");
      const aVal = String(afterAttr[field] ?? "");
      if (bVal !== aVal) {
        changes.push({
          type: "modify-attribute",
          attributeId: afterAttr.id,
          attributeName: afterAttr.name,
          field,
          before: bVal,
          after: aVal,
        });
      }
    }

    // Value-level changes
    const beforeValues = new Map(beforeAttr.values.map((v) => [v.value, v]));
    const afterValues = new Map(afterAttr.values.map((v) => [v.value, v]));

    for (const v of beforeAttr.values) {
      if (!afterValues.has(v.value)) {
        changes.push({ type: "remove-value", attributeId: afterAttr.id, attributeName: afterAttr.name, value: v });
      }
    }

    for (const v of afterAttr.values) {
      if (!beforeValues.has(v.value)) {
        changes.push({ type: "add-value", attributeId: afterAttr.id, attributeName: afterAttr.name, value: v });
      }
    }

    for (const afterVal of afterAttr.values) {
      const beforeVal = beforeValues.get(afterVal.value);
      if (!beforeVal) continue;
      if (
        beforeVal.label !== afterVal.label ||
        beforeVal.description !== afterVal.description ||
        JSON.stringify(beforeVal.colors) !== JSON.stringify(afterVal.colors)
      ) {
        changes.push({
          type: "modify-value",
          attributeId: afterAttr.id,
          attributeName: afterAttr.name,
          valueBefore: beforeVal,
          valueAfter: afterVal,
        });
      }
    }
  }

  return changes;
}

// ── Apply ───────────────────────────────────────────────

export function applyConfigChanges(
  config: AttributeConfigJson,
  allChanges: ConfigChange[],
  selectedIndices: Set<number>,
): AttributeConfigJson {
  // Build selected change lists by type
  const selected = allChanges.filter((_, i) => selectedIndices.has(i));
  const removedAttrIds = new Set(
    selected.filter((c) => c.type === "remove-attribute").map((c) => (c as { attribute: Attribute }).attribute.id),
  );
  const addedAttrs = selected
    .filter((c) => c.type === "add-attribute")
    .map((c) => (c as { attribute: Attribute }).attribute);
  const modifiedFields = selected.filter((c) => c.type === "modify-attribute") as Extract<ConfigChange, { type: "modify-attribute" }>[];
  const addedValues = selected.filter((c) => c.type === "add-value") as Extract<ConfigChange, { type: "add-value" }>[];
  const removedValues = selected.filter((c) => c.type === "remove-value") as Extract<ConfigChange, { type: "remove-value" }>[];
  const modifiedValues = selected.filter((c) => c.type === "modify-value") as Extract<ConfigChange, { type: "modify-value" }>[];

  // Group value changes by attribute
  const addedByAttr = new Map<string, AttributeValue[]>();
  for (const c of addedValues) {
    const arr = addedByAttr.get(c.attributeId) ?? [];
    arr.push(c.value);
    addedByAttr.set(c.attributeId, arr);
  }
  const removedByAttr = new Map<string, Set<string>>();
  for (const c of removedValues) {
    const set = removedByAttr.get(c.attributeId) ?? new Set();
    set.add(c.value.value);
    removedByAttr.set(c.attributeId, set);
  }
  const modifiedByAttr = new Map<string, Map<string, AttributeValue>>();
  for (const c of modifiedValues) {
    const map = modifiedByAttr.get(c.attributeId) ?? new Map();
    map.set(c.valueAfter.value, c.valueAfter);
    modifiedByAttr.set(c.attributeId, map);
  }

  // Apply to existing attributes (preserve order)
  const attributes = config.attributes
    .filter((a) => !removedAttrIds.has(a.id))
    .map((attr) => {
      let updated = { ...attr };

      // Apply field modifications
      for (const mod of modifiedFields) {
        if (mod.attributeId !== attr.id) continue;
        updated = { ...updated, [mod.field]: mod.field === "enabled" ? mod.after === "true" : mod.after };
      }

      // Apply value changes
      const toRemove = removedByAttr.get(attr.id);
      const toAdd = addedByAttr.get(attr.id);
      const toModify = modifiedByAttr.get(attr.id);

      if (toRemove || toAdd || toModify) {
        let values = updated.values;
        if (toRemove) values = values.filter((v) => !toRemove.has(v.value));
        if (toModify) values = values.map((v) => toModify.get(v.value) ?? v);
        if (toAdd) values = [...values, ...toAdd];
        updated = { ...updated, values };
      }

      return updated;
    });

  // Append new attributes at end
  return { ...config, attributes: [...attributes, ...addedAttrs] };
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/attribute-diff.ts
git commit -m "feat: add attribute config diff engine"
```

---

### Task 2: API Endpoint

**Files:**
- Create: `src/app/api/attributes/edit/route.ts`
- Modify: `src/lib/validations.ts` — add `aiEditSchema`

- [ ] **Step 1: Add validation schema to `src/lib/validations.ts`**

Add after the existing `aiFillSchema`:

```typescript
export const aiEditSchema = z.object({
  prompt: z.string().min(1).max(AI_FILL_PROMPT_MAX_LENGTH),
});
```

Ensure `AI_FILL_PROMPT_MAX_LENGTH` is imported from `@/lib/constants`.

- [ ] **Step 2: Create `src/app/api/attributes/edit/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiEditSchema } from "@/lib/validations";
import { reserveAiFillCredits, InsufficientCreditsError } from "@/lib/credits";
import type { AttributeConfigJson, Attribute } from "@/lib/attributes";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash";
const FETCH_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a book cover attribute configuration editor. Your job is to modify attribute configurations based on user instructions.

You will receive the user's current attribute configuration as JSON — an array of attributes, each with id, name, type, enabled, description, values, and optional scaleLabels.

## Attribute Types

- "single": Pick one value from a list. Values have: value (slug), label, builtIn, description (optional), colors (optional).
- "multi": Pick multiple values as tags. Same value structure as single.
- "text": Free-form text. No predefined values array (keep it empty).
- "toggle": On/off. No predefined values array (keep it empty).
- "scale": Number 0-10. No predefined values array. May have scaleLabels: { min, max } for endpoint labels.
- "color": Hex color value. No predefined values array.
- "palette": Curated color sets. Values MUST include a "colors" array with exactly 5 hex strings, e.g. ["#0a0a0f", "#1a1a2e", "#4a1942", "#c84b31", "#fbbf24"].

## Rules

- Return the COMPLETE attributes array with all modifications applied.
- Only change what the user asks for. Preserve all other attributes, values, and fields exactly as-is.
- Preserve the original ordering of attributes and values. Append new items at the end.
- For new attributes: set builtIn to false, enabled to true. Generate a slug id from the name (lowercase, hyphens for spaces).
- For new values: set builtIn to false. Generate a slug value from the label. Include a description explaining how it affects the cover.
- Preserve existing builtIn flags — never change them.
- The result must have at least 1 attribute.
- Do NOT include explanations or commentary — only the JSON object.

## Response Format

Respond with valid JSON:
{ "attributes": [ ...complete attribute array... ] }`;

function serializeConfig(config: AttributeConfigJson): string {
  return JSON.stringify({ attributes: config.attributes }, null, 2);
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = aiEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { prompt } = parsed.data;

  const configRecord = await prisma.attributeConfig.findUnique({
    where: { userId: session.user.id },
    select: { config: true },
  });

  if (!configRecord) {
    return NextResponse.json({ error: "No attribute config found" }, { status: 404 });
  }

  try {
    await reserveAiFillCredits(session.user.id);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: `Insufficient credits: need ${err.required}, have ${err.available}` },
        { status: 403 },
      );
    }
    throw err;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const before = configRecord.config as unknown as AttributeConfigJson;
    const configJson = serializeConfig(before);
    const userPrompt = `Current attribute configuration:\n\n${configJson}\n\n---\n\nUser's instruction: ${prompt}`;

    const res = await fetch(
      `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[ai-edit] Gemini HTTP ${res.status}:`, errorBody);
      throw new Error(
        res.status === 429
          ? "Rate limited — please try again in a moment"
          : "Failed to generate config changes",
      );
    }

    const data = await res.json();
    const textPart = data?.candidates?.[0]?.content?.parts?.find(
      (p: Record<string, unknown>) => typeof p.text === "string",
    );

    if (!textPart?.text) throw new Error("No response from AI model");

    let parsed: unknown;
    try {
      parsed = JSON.parse(textPart.text);
    } catch {
      console.error("[ai-edit] Failed to parse Gemini JSON:", textPart.text);
      throw new Error("AI returned invalid response — please try again");
    }

    // Basic shape validation
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as { attributes?: unknown }).attributes)
    ) {
      throw new Error("AI returned unexpected format — please try again");
    }

    const afterAttributes = (parsed as { attributes: Attribute[] }).attributes.map((a) => ({
      ...a,
      // Ensure required fields have defaults
      enabled: a.enabled ?? true,
      builtIn: a.builtIn ?? false,
      values: (a.values ?? []).map((v) => ({
        ...v,
        builtIn: v.builtIn ?? false,
      })),
    }));

    // Preserve briefPosition from original config
    const after: AttributeConfigJson = {
      ...before,
      attributes: afterAttributes,
    };

    return NextResponse.json({ before, after });
  } catch (err) {
    console.error("[ai-edit] Failed:", err);
    const message = err instanceof Error ? err.message : "Failed to edit attributes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations.ts src/app/api/attributes/edit/route.ts
git commit -m "feat: add AI edit attributes API endpoint"
```

---

### Task 3: Client API Function

**Files:**
- Modify: `src/lib/api/ai-fill.ts` — add `editAttributeConfig` function

- [ ] **Step 1: Add client function to `src/lib/api/ai-fill.ts`**

Add below the existing `generateAttributes` function:

```typescript
import type { AttributeConfigJson } from "@/lib/attributes";

interface EditAttributeConfigResponse {
  before: AttributeConfigJson;
  after: AttributeConfigJson;
}

export async function editAttributeConfig(
  prompt: string,
): Promise<EditAttributeConfigResponse> {
  const { data } = await api.post<EditAttributeConfigResponse>(
    "/api/attributes/edit",
    { prompt },
  );
  return data;
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/ai-fill.ts
git commit -m "feat: add editAttributeConfig client function"
```

---

### Task 4: AI Edit Popover Component

**Files:**
- Create: `src/app/settings/ai-edit-popover.tsx`

Pattern: mirrors `src/components/editor/ai-fill-popover.tsx` but without `projectId` (operates on global config).

- [ ] **Step 1: Create `src/app/settings/ai-edit-popover.tsx`**

Uses `@base-ui/react/popover` directly (same pattern as `src/components/editor/ai-fill-popover.tsx`). Note: credit store field is `balance` (not `creditBalance`).

```tsx
"use client";

import { useRef } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Sparkles, Loader2, AlertTriangle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditStore } from "@/lib/stores/credit-store";
import { editAttributeConfig } from "@/lib/api/ai-fill";
import { AI_FILL_CREDIT_COST, AI_FILL_PROMPT_MAX_LENGTH } from "@/lib/constants";
import { toast } from "sonner";
import type { AttributeConfigJson } from "@/lib/attributes";

interface AiEditPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  onResult: (before: AttributeConfigJson, after: AttributeConfigJson) => void;
}

export function AiEditPopover({
  open,
  onOpenChange,
  prompt,
  onPromptChange,
  loading,
  onLoadingChange,
  onResult,
}: AiEditPopoverProps): React.ReactElement {
  const anchorRef = useRef<HTMLDivElement>(null);
  const balance = useCreditStore((s) => s.balance);
  const hasEnoughCredits = balance >= AI_FILL_CREDIT_COST;

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    onLoadingChange(true);
    try {
      const { before, after } = await editAttributeConfig(trimmed);
      onResult(before, after);
      onOpenChange(false);
      useCreditStore.getState().refreshCredits();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to edit attributes";
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
          className="gap-2"
          onClick={() => onOpenChange(!open)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin text-yellow-500" />
          ) : (
            <Sparkles className="size-4 text-yellow-500" />
          )}
          AI Edit
        </Button>
      </div>

      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner
            anchor={anchorRef}
            side="bottom"
            sideOffset={4}
            align="end"
          >
            <PopoverPrimitive.Popup className="z-50 w-80 rounded-lg border bg-popover p-3 shadow-md text-xs space-y-2.5">
              <p className="font-medium text-sm">Edit attributes with AI</p>
              <p className="text-muted-foreground">
                Describe what to change — add, remove, or modify attributes and values.
              </p>

              {!hasEnoughCredits && (
                <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-destructive">
                  <AlertTriangle className="size-3 shrink-0" />
                  Insufficient credits.
                </div>
              )}

              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder='e.g. "Add a Lighting attribute with dramatic, soft, and neon values"'
                maxLength={AI_FILL_PROMPT_MAX_LENGTH}
                disabled={loading}
                autoFocus
                className="flex w-full resize-none overflow-hidden rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
              />
              <p className="text-right text-muted-foreground">
                {prompt.length}/{AI_FILL_PROMPT_MAX_LENGTH}
              </p>

              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading || !hasEnoughCredits}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3" />
                    Generate Changes
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Coins className="size-3 text-yellow-500" />
                <span>1 credit</span>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/ai-edit-popover.tsx
git commit -m "feat: add AI edit popover component for settings"
```

---

### Task 5: AI Edit Review Dialog

**Files:**
- Create: `src/app/settings/ai-edit-review-dialog.tsx`

- [ ] **Step 1: Create `src/app/settings/ai-edit-review-dialog.tsx`**

Uses shadcn `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` wrappers (same pattern as `ai-fill-review-dialog.tsx`). Inline checkbox via button+div (no `Checkbox` component). Selection reset uses `useRef` to detect changes.

```tsx
"use client";

import { useState, useMemo, useRef } from "react";
import { Check, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diffAttributeConfigs, applyConfigChanges, type ConfigChange } from "@/lib/attribute-diff";
import { AI_FILL_CREDIT_COST } from "@/lib/constants";
import type { AttributeConfigJson } from "@/lib/attributes";

interface AiEditReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: AttributeConfigJson | null;
  after: AttributeConfigJson | null;
  onApply: (config: AttributeConfigJson) => void;
  onRegenerate: () => void;
}

function formatChange(change: ConfigChange): string {
  switch (change.type) {
    case "add-attribute":
      return `Add attribute: ${change.attribute.name} (${change.attribute.type})`;
    case "remove-attribute":
      return `Remove attribute: ${change.attribute.name}`;
    case "modify-attribute":
      return `Change ${change.field} of ${change.attributeName}`;
    case "add-value":
      return `Add value "${change.value.label}" to ${change.attributeName}`;
    case "remove-value":
      return `Remove value "${change.value.label}" from ${change.attributeName}`;
    case "modify-value":
      return `Update value "${change.valueBefore.label}" in ${change.attributeName}`;
  }
}

function ChangeBadge({ type }: { type: ConfigChange["type"] }) {
  if (type === "add-attribute" || type === "add-value")
    return <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">Add</Badge>;
  if (type === "remove-attribute" || type === "remove-value")
    return <Badge className="bg-red-500/10 text-red-500 text-xs">Remove</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500 text-xs">Change</Badge>;
}

function DiffDetail({ change }: { change: ConfigChange }) {
  if (change.type === "modify-attribute") {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        <span className="line-through">{change.before || "(empty)"}</span>
        {" → "}
        <span className="text-foreground">{change.after || "(empty)"}</span>
      </div>
    );
  }
  if (change.type === "modify-value") {
    const parts: string[] = [];
    if (change.valueBefore.label !== change.valueAfter.label)
      parts.push(`label: "${change.valueBefore.label}" → "${change.valueAfter.label}"`);
    if (change.valueBefore.description !== change.valueAfter.description)
      parts.push(`description updated`);
    if (JSON.stringify(change.valueBefore.colors) !== JSON.stringify(change.valueAfter.colors))
      parts.push(`colors updated`);
    return <div className="text-xs text-muted-foreground mt-1">{parts.join(", ")}</div>;
  }
  if (change.type === "add-attribute" && change.attribute.values.length > 0) {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Values: {change.attribute.values.map((v) => v.label).join(", ")}
      </div>
    );
  }
  if (change.type === "add-value" && change.value.description) {
    return <div className="text-xs text-muted-foreground mt-1">{change.value.description}</div>;
  }
  return null;
}

export function AiEditReviewDialog({
  open,
  onOpenChange,
  before,
  after,
  onApply,
  onRegenerate,
}: AiEditReviewDialogProps) {
  const changes = useMemo(
    () => (before && after ? diffAttributeConfigs(before, after) : []),
    [before, after],
  );

  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  // Reset selection when changes update (render-time reset like AiFillReviewDialog)
  const prevChangesRef = useRef(changes);
  if (prevChangesRef.current !== changes) {
    prevChangesRef.current = changes;
    setSelected(new Set(changes.map((_, i) => i)));
  }

  function toggleChange(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleApply() {
    if (!before) return;
    const result = applyConfigChanges(before, changes, selected);
    onApply(result);
    onOpenChange(false);
  }

  // Check if applying would result in 0 attributes
  const wouldBeEmpty = useMemo(() => {
    if (!before || selected.size === 0) return false;
    const result = applyConfigChanges(before, changes, selected);
    return result.attributes.length === 0;
  }, [before, changes, selected]);

  // Group changes by attribute for display
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; indices: number[] }>();
    changes.forEach((c, i) => {
      let key: string;
      let label: string;
      if (c.type === "add-attribute") {
        key = `new:${c.attribute.id}`;
        label = c.attribute.name;
      } else if (c.type === "remove-attribute") {
        key = `remove:${c.attribute.id}`;
        label = c.attribute.name;
      } else {
        key = c.attributeId;
        label = c.attributeName;
      }
      const group = groups.get(key) ?? { label, indices: [] };
      group.indices.push(i);
      groups.set(key, group);
    });
    return groups;
  }, [changes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {changes.length === 0
              ? "No Changes Detected"
              : "Review AI Changes"}
          </DialogTitle>
        </DialogHeader>

        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The AI didn&apos;t suggest any changes. Try rephrasing your instruction.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {changes.length} change{changes.length !== 1 ? "s" : ""} suggested. Uncheck any you don&apos;t want.
            </p>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {[...grouped.entries()].map(([key, group]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2">
                    {group.label}
                  </p>
                  {group.indices.map((i) => {
                    const change = changes[i];
                    const checked = selected.has(i);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleChange(i)}
                      >
                        <button type="button" className="mt-0.5 shrink-0">
                          <div
                            className={`flex size-4 items-center justify-center rounded border transition-colors ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {checked && <Check className="size-3" />}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <ChangeBadge type={change.type} />
                            <span className="text-sm">{formatChange(change)}</span>
                          </div>
                          <DiffDetail change={change} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={onRegenerate} className="gap-1.5">
            <Coins className="size-3" />
            Regenerate
          </Button>
          {changes.length > 0 && (
            <Button
              size="sm"
              onClick={handleApply}
              disabled={selected.size === 0 || wouldBeEmpty}
            >
              Apply {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/ai-edit-review-dialog.tsx
git commit -m "feat: add AI edit review dialog for settings"
```

---

### Task 6: Integrate into Attributes Tab

**Files:**
- Modify: `src/app/settings/attributes-tab.tsx`

Three changes: add AI Edit popover + review dialog, remove `!attribute.builtIn` guard on delete, add "Restore Built-in Attributes" button.

- [ ] **Step 1: Add AI Edit state and imports**

Add imports at top of `attributes-tab.tsx`:

```typescript
import { ensureBuiltInAttributes } from "@/lib/attributes";
import { useCreditStore } from "@/lib/stores/credit-store";
import { AiEditPopover } from "./ai-edit-popover";
import { AiEditReviewDialog } from "./ai-edit-review-dialog";
```

Add state inside the `AttributesTab` component, after the existing state declarations:

```typescript
const [aiEditOpen, setAiEditOpen] = useState(false);
const [aiEditPrompt, setAiEditPrompt] = useState("");
const [aiEditLoading, setAiEditLoading] = useState(false);
const [aiEditBefore, setAiEditBefore] = useState<AttributeConfigJson | null>(null);
const [aiEditAfter, setAiEditAfter] = useState<AttributeConfigJson | null>(null);
const [reviewOpen, setReviewOpen] = useState(false);
```

Add handlers:

```typescript
function handleAiEditResult(before: AttributeConfigJson, after: AttributeConfigJson) {
  setAiEditBefore(before);
  setAiEditAfter(after);
  setReviewOpen(true);
}

function handleAiEditApply(newConfig: AttributeConfigJson) {
  onSave(newConfig);
  useCreditStore.getState().refreshCredits();
  setAiEditPrompt("");
  toast.success("AI changes applied");
}

function handleAiEditRegenerate() {
  setReviewOpen(false);
  setAiEditOpen(true);
  // User can tweak prompt and re-submit (will open popover again)
}

function handleRestoreBuiltIn() {
  const restored = ensureBuiltInAttributes(config);
  if (restored === config) {
    toast.info("All built-in attributes are already present");
    return;
  }
  onSave(restored);
  toast.success("Built-in attributes restored");
}
```

- [ ] **Step 2: Add AI Edit popover to the header area**

In the JSX return, wrap the "Add Attribute" button area with a flex container that includes the AI Edit popover. Replace the bottom portion of the return (lines 129-179 approximately — the `addingAttribute` ternary and Add Attribute button) with:

```tsx
<div className="flex gap-2">
  <AiEditPopover
    open={aiEditOpen}
    onOpenChange={setAiEditOpen}
    prompt={aiEditPrompt}
    onPromptChange={setAiEditPrompt}
    loading={aiEditLoading}
    onLoadingChange={setAiEditLoading}
    onResult={handleAiEditResult}
  />
  {/* Keep existing Add Attribute button/form here */}
</div>
```

Place the popover just before the Add Attribute button (both as siblings in a flex row) or as a standalone button above the attribute list. The exact placement: add a flex row before the attribute cards that contains the AI Edit popover and Add Attribute button.

- [ ] **Step 3: Remove `!attribute.builtIn` guard on delete**

In `AttributeCard` (line 266), change:

```tsx
{!attribute.builtIn && (
  <Button ...>
    <Trash2Icon ... />
  </Button>
)}
```

To:

```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="text-muted-foreground hover:text-destructive"
  onClick={onRemoveAttribute}
>
  <Trash2Icon className="size-3.5" />
</Button>
```

- [ ] **Step 4: Add Restore Built-in button and review dialog**

Add at the bottom of the component's JSX return, after the Add Attribute button:

```tsx
<Button
  variant="outline"
  className="w-full gap-2"
  onClick={handleRestoreBuiltIn}
>
  <RotateCcwIcon className="size-4" />
  Restore Built-in Attributes
</Button>

<AiEditReviewDialog
  open={reviewOpen}
  onOpenChange={setReviewOpen}
  before={aiEditBefore}
  after={aiEditAfter}
  onApply={handleAiEditApply}
  onRegenerate={handleAiEditRegenerate}
/>
```

Note: `RotateCcwIcon` is already imported (line 8).

- [ ] **Step 5: Verify no type errors**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Manual test**

1. Start dev server: `npm run dev`
2. Go to Settings → Attributes tab
3. Verify AI Edit button appears next to Add Attribute
4. Verify all attributes (including built-in) have a delete button
5. Verify "Restore Built-in Attributes" button appears at the bottom
6. Click AI Edit → type "Add a Lighting attribute with dramatic, soft, and neon values" → submit
7. Verify review dialog shows changes with checkboxes
8. Uncheck one change, verify Apply count updates
9. Click Apply, verify attribute config updates
10. Delete a built-in attribute (e.g., Genre), verify it's removed
11. Click "Restore Built-in Attributes", verify Genre reappears

- [ ] **Step 7: Commit**

```bash
git add src/app/settings/attributes-tab.tsx
git commit -m "feat: integrate AI edit, built-in deletion, and restore into attributes tab"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Lint check**

Run: `npm run lint`

- [ ] **Step 3: Fix any issues found and commit**
