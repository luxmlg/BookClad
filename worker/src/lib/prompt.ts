import { REF_PROMPT_KEY } from "./constants.js";

// ── Types ────────────────────────────────────────────────────────

export interface ValueMeta {
  label: string;
  description?: string;
}

export interface AttrMeta {
  name: string;
  description?: string;
  values: Record<string, ValueMeta>;
}

/** Keyed by attribute ID. */
export type DescriptionsMap = Record<string, AttrMeta>;

// ── Extraction ───────────────────────────────────────────────────

/**
 * Extract attribute metadata from the raw AttributeConfig JSON.
 * Returns `{}` on any unexpected shape.
 */
export function extractDescriptions(configJson: unknown): DescriptionsMap {
  if (
    !configJson ||
    typeof configJson !== "object" ||
    !("attributes" in configJson) ||
    !Array.isArray((configJson as { attributes: unknown }).attributes)
  ) {
    return {};
  }

  const result: DescriptionsMap = {};
  for (const attr of (configJson as { attributes: unknown[] }).attributes) {
    if (!attr || typeof attr !== "object" || !("id" in attr)) continue;
    const { id, name, description, values } = attr as {
      id: unknown;
      name: unknown;
      description: unknown;
      values: unknown;
    };
    if (typeof id !== "string") continue;

    const valueMeta: Record<string, ValueMeta> = {};
    if (Array.isArray(values)) {
      for (const v of values) {
        if (!v || typeof v !== "object") continue;
        const { value, label, description: vDesc } = v as {
          value: unknown;
          label: unknown;
          description: unknown;
        };
        if (typeof value !== "string") continue;
        valueMeta[value] = {
          label: typeof label === "string" ? label : attributeLabel(value),
          description: typeof vDesc === "string" && vDesc ? vDesc : undefined,
        };
      }
    }

    result[id] = {
      name: typeof name === "string" ? name : attributeLabel(id),
      description: typeof description === "string" && description ? description : undefined,
      values: valueMeta,
    };
  }
  return result;
}

// ── Text layers ──────────────────────────────────────────────────

export interface TextLayerInfo {
  name: string;
  text: string;
  visible: boolean;
}

export interface PromptOptions {
  includeLayers: boolean;
  textLayers: TextLayerInfo[];
  isReference: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatAttrValue(
  val: string | string[],
  valueMeta?: Record<string, ValueMeta>,
): string {
  const values = Array.isArray(val) ? val : [val];
  return values
    .map((v) => {
      if (v === "true") return "yes";
      if (v === "false") return "no";
      return valueMeta?.[v]?.label ?? v;
    })
    .join(", ");
}

function attributeLabel(key: string): string {
  return key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isEmpty(val: string | string[]): boolean {
  return val === "" || (Array.isArray(val) && val.length === 0);
}

// ── System prompt ────────────────────────────────────────────────

function buildTypographySpacing(options: PromptOptions): string {
  if (!options.includeLayers || options.textLayers.length === 0) {
    return "- Keep the upper 20% and lower 15% of the image relatively uncluttered to allow text overlay later";
  }

  const visibleLayers = options.textLayers.filter((l) => l.visible);
  if (visibleLayers.length === 0) {
    return "- Keep the upper 20% and lower 15% of the image relatively uncluttered to allow text overlay later";
  }

  return `- Text overlays will be composited after generation. Keep these regions clear:\n  - Upper area for title\n  - Lower area for author name`;
}

/** Fixed system instructions — no user attributes. */
export function buildSystemPrompt(options: PromptOptions): string {
  const typographySpacing = buildTypographySpacing(options);
  const referenceClause = options.isReference
    ? `\nYou are provided with a reference cover image. Use it as a mood board — match its overall atmosphere, composition approach, and color temperature. Generate an original image inspired by it, not a copy.\n`
    : "";

  return `You are a professional book cover designer creating covers for Amazon Kindle Direct Publishing.
${referenceClause}
CRITICAL — No text in the image:
- Do NOT render any text, letters, words, numbers, titles, or typography anywhere in the image
- This includes stylized, decorative, or partially obscured text — generate none whatsoever
- The image must be purely visual with zero readable characters
- Unless the user's attributes below explicitly request specific text to appear in the image

Output format:
- Portrait orientation, 1.6:1 aspect ratio (will be cropped to 1600×2560 px at 300 DPI)
- No watermarks, logos, borders, or frames
- Edge-to-edge artwork — no margins or blank space around the illustration

Design principles:
- Thumbnail-first: the cover must be instantly readable at 120 px wide on Amazon search results
- One dominant focal point with strong figure-ground contrast
- Use lighting, depth of field, or color contrast to draw the eye to the subject
- Color palette should reflect the genre and mood — avoid clashing or muddy tones
${typographySpacing}`;
}

// ── Attribute context (descriptions) ─────────────────────────────

/**
 * Build a context block listing attribute descriptions.
 * Only includes attributes that have a description set.
 */
export function buildAttributeContext(
  attributes: Record<string, string | string[]>,
  descriptions?: DescriptionsMap,
): string {
  if (!descriptions) return "";

  const lines: string[] = [];
  for (const key of Object.keys(attributes)) {
    if (isEmpty(attributes[key])) continue;
    const meta = descriptions[key];
    if (!meta?.description) continue;
    lines.push(`- ${meta.name}: ${meta.description}`);
  }

  if (lines.length === 0) return "";
  return `Attribute context:\n${lines.join("\n")}`;
}

// ── Attribute values ─────────────────────────────────────────────

const PROMPT_LABELS: Record<string, string> = {
  [REF_PROMPT_KEY]: "Additional instructions",
};

/**
 * Build the selected-attributes block with value descriptions.
 * No hardcoded attribute names — uses metadata from descriptions map.
 */
export function buildAttributeValues(
  attributes: Record<string, string | string[]>,
  descriptions?: DescriptionsMap,
): string {
  const parts: string[] = [];

  for (const [key, val] of Object.entries(attributes)) {
    if (isEmpty(val)) continue;

    const meta = descriptions?.[key];
    const label = PROMPT_LABELS[key] ?? meta?.name ?? attributeLabel(key);
    const formatted = formatAttrValue(val, meta?.values);

    // Collect value descriptions for selected values
    const values = Array.isArray(val) ? val : [val];
    const valueDescs = values
      .map((v) => {
        const desc = meta?.values[v]?.description;
        const vLabel = meta?.values[v]?.label ?? v;
        return desc ? `${vLabel} — ${desc}` : null;
      })
      .filter((d): d is string => d !== null);

    if (valueDescs.length > 0) {
      // Include value descriptions inline
      parts.push(`${label}: ${formatted}`);
      parts.push(valueDescs.join(". "));
    } else {
      parts.push(`${label}: ${formatted}`);
    }
  }

  return parts.join("\n");
}
