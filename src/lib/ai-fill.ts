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
      "attributeId": "the exact id from the attribute config, or null for new attributes",
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
CRITICAL: For "attributeId", you MUST use the exact id string shown in brackets [id: "..."] for each attribute. For example, if an attribute shows [id: "genre"], use "genre" as the attributeId. Set to null only for brand new attributes.`;

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
