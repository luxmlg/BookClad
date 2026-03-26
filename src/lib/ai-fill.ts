import { z } from "zod";
import { slugify, addValueToAttribute, deduplicateValues } from "@/lib/attributes";
import type { AttributeConfigJson, AttributeSelection, Attribute } from "@/lib/attributes";

// --- Types ---

export interface AiFillSuggestion {
  attributeId: string | null;
  name?: string;
  type?: Attribute["type"];
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

export interface AiFillResult {
  suggestions: AiFillSuggestion[];
  responseJson: Record<string, unknown>;
  durationMs: number;
}

// --- Response validation ---

const suggestionSchema = z.object({
  attributeId: z.string().nullable(),
  name: z.string().optional(),
  type: z.enum(["single", "multi", "text", "toggle", "scale", "color", "palette"]).optional(),
  value: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
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
    lines.push(`${attr.name} [id: "${attr.id}"] (${attr.type}): ${attr.description ?? "No description"}`);

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

const SYSTEM_PROMPT = `You are a creative book cover design consultant. Your goal is to give users the best possible attribute setup for generating stunning ebook covers.

You will receive:
1. The user's full attribute configuration — every attribute with its id, type, available values, and descriptions
2. The user's current selections for each attribute
3. The user's direction — what they want to change, improve, or create

## Attribute Types

- "single": Pick exactly one value (or create a new one with value/label/description)
- "multi": Pick one or more values as tags (or create new ones)
- "text": Free-form descriptive content — write vivid, specific descriptions
- "toggle": "true" or "false"
- "scale": A number from 0 to 10 as a string (e.g. "7")
- "color": A hex color value like "#3b82f6"
- "palette": A curated color set. IMPORTANT: When creating new palette values, you MUST include a "colors" array with exactly 5 hex color strings, e.g. ["#0a0a0f", "#1a1a2e", "#4a1942", "#c84b31", "#fbbf24"]. Palette values without a colors array are broken and unusable.

## Your Approach

**Think holistically.** When the user's direction shifts the vibe of the cover, update everything that's affected — genre, mood, art style, palette, visual elements, and more. Don't leave attributes describing the old direction.

**Always rewrite Visual Elements.** This is the most impactful attribute for generation quality. When the direction changes, rewrite it completely with vivid, specific imagery that matches the new vision. Never leave it stale.

**Prefer structure over text dumps.** If a concept can be its own attribute (Lighting, Camera Angle, Atmosphere, Setting, Time of Day, Composition, etc.), suggest it as a new structured attribute rather than cramming everything into the Visual Elements text field. Structured attributes give users more control and produce better generations.

**Be generous with suggestions.** Suggest 2-3 new attributes when they would improve generation quality. The cost of suggesting too many is low — users can uncheck what they don't want. The cost of suggesting too few is a mediocre cover. Good new attributes to consider: Lighting, Camera Angle/Perspective, Atmosphere, Setting/Environment, Time of Day, Composition Style, Figure Pose/Action, Typography Style.

**Respect the user's custom work.** If the user has manually created custom attributes, don't modify them unless the direction specifically relates to them.

## Value Creation Rules

- For existing attributes with predefined values, prefer picking from existing values. Only create new values when nothing existing fits well.
- When creating new values: provide a slug-style "value", a human-readable "label", and a "description" explaining how it affects the cover.
- For palette-type attributes: always include a "colors" array with exactly 5 hex color strings.
- For new attributes: provide a full definition with name, type, description, and initial values.

## Response Format

Respond with valid JSON:
{
  "suggestions": [
    {
      "attributeId": "exact-id-from-config or null for new",
      "name": "Attribute Name",
      "type": "single|multi|text|toggle|scale|color|palette",
      "value": "selected-value-slug" or ["value1", "value2"],
      "isNew": false,
      "newValues": [{"value": "slug", "label": "Display Label", "description": "How this affects the cover", "colors": ["#hex1", ...]}],
      "newAttribute": { "name": "...", "type": "...", "description": "...", "values": [...], "scaleLabels": {"min": "...", "max": "..."} }
    }
  ]
}

- Set "isNew": true and include "newAttribute" for brand new attributes not in the current config.
- Set "newValues" when adding values that don't exist in the attribute's current value list.
- CRITICAL: For "attributeId", use the exact id shown in brackets [id: "..."] in the attribute list. Set to null only for brand new attributes.
- NEVER return an empty value ("" or []). Every suggestion must have a concrete value. Only suggest attributes you are setting a value for.
- Do NOT include explanations, reasoning, or commentary — only the JSON object.`;

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
): Promise<AiFillResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const startTime = Date.now();

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
    const durationMs = Date.now() - startTime;
    const errorBody = await res.text().catch(() => "");
    console.error(`[ai-fill] Gemini HTTP ${res.status}:`, errorBody);
    throw Object.assign(
      new Error(
        res.status === 429
          ? "Rate limited — please try again in a moment"
          : "Failed to generate attribute suggestions"
      ),
      { status: res.status, durationMs, errorBody },
    );
  }

  const data = await res.json();
  const durationMs = Date.now() - startTime;
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

  return {
    suggestions,
    responseJson: data as Record<string, unknown>,
    durationMs,
  };
}

// --- Apply suggestions utility ---

export function applySuggestions(
  config: AttributeConfigJson,
  baseSelection: AttributeSelection,
  suggestions: AiFillSuggestion[],
): { config: AttributeConfigJson; selection: AttributeSelection } {
  let updatedConfig = config;
  const updatedSelection = { ...baseSelection };

  for (const suggestion of suggestions) {
    let resolvedId =
      suggestion.isNew && suggestion.newAttribute
        ? slugify(suggestion.newAttribute.name)
        : suggestion.attributeId;

    if (!resolvedId) continue;

    // Skip suggestions with empty/whitespace-only values before modifying config
    const isEmpty = Array.isArray(suggestion.value)
      ? suggestion.value.length === 0
      : suggestion.value.trim() === "";
    if (isEmpty) continue;

    // Disambiguate new attribute IDs that collide with existing ones
    if (suggestion.isNew && suggestion.newAttribute) {
      let candidateId = resolvedId;
      let suffix = 2;
      while (updatedConfig.attributes.some((a) => a.id === candidateId)) {
        candidateId = `${resolvedId}-${suffix}`;
        suffix++;
      }
      resolvedId = candidateId;
    }

    const existingAttr = updatedConfig.attributes.find((a) => a.id === resolvedId);

    if (!existingAttr && suggestion.newAttribute) {
      const newAttr: Attribute = {
        id: resolvedId,
        name: suggestion.newAttribute.name,
        type: suggestion.newAttribute.type,
        builtIn: false,
        enabled: true,
        description: suggestion.newAttribute.description,
        values: deduplicateValues(
          (suggestion.newAttribute.values ?? []).map((v) => ({
            ...v,
            builtIn: false,
          })),
        ),
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
