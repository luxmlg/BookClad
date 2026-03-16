import { REF_PROMPT_KEY } from "./constants.js";

/** Descriptions keyed by category ID, then by value slug. */
export type DescriptionsMap = Record<string, Record<string, string>>;

/**
 * Extract a descriptions map from the raw AttributeConfig JSON.
 * Returns `{}` on any unexpected shape.
 */
export function extractDescriptions(configJson: unknown): DescriptionsMap {
  if (
    !configJson ||
    typeof configJson !== "object" ||
    !("categories" in configJson) ||
    !Array.isArray((configJson as { categories: unknown }).categories)
  ) {
    return {};
  }

  const result: DescriptionsMap = {};
  for (const cat of (configJson as { categories: unknown[] }).categories) {
    if (!cat || typeof cat !== "object" || !("id" in cat) || !("values" in cat)) continue;
    const { id, values } = cat as { id: string; values: unknown[] };
    if (typeof id !== "string" || !Array.isArray(values)) continue;

    const descs: Record<string, string> = {};
    for (const v of values) {
      if (!v || typeof v !== "object") continue;
      const { value, description } = v as { value: unknown; description: unknown };
      if (typeof value === "string" && typeof description === "string" && description) {
        descs[value] = description;
      }
    }
    if (Object.keys(descs).length > 0) {
      result[id] = descs;
    }
  }
  return result;
}

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

function formatAttrValue(val: string | string[]): string {
  if (Array.isArray(val)) return val.join(", ");
  if (val === "true") return "yes";
  if (val === "false") return "no";
  return val;
}

function categoryLabel(key: string): string {
  return key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTypographySpacing(options: PromptOptions): string {
  if (!options.includeLayers || options.textLayers.length === 0) {
    return "- Leave uncluttered space in the upper third for title text and in the lower fifth for the author name";
  }

  const visibleLayers = options.textLayers.filter((l) => l.visible);
  if (visibleLayers.length === 0) {
    return "- Leave uncluttered space in the upper third for title text and in the lower fifth for the author name";
  }

  const layerList = visibleLayers
    .map((l) => `  - "${l.text}" (${l.name})`)
    .join("\n");

  return `- Text will be composited onto the image. Account for the following text placement:\n${layerList}`;
}

/** Fixed system instructions — no user attributes. */
export function buildSystemPrompt(options: PromptOptions): string {
  const typographySpacing = buildTypographySpacing(options);
  const referenceClause = options.isReference
    ? `\nYou are provided with a reference cover image. Create a new, original variation that matches its mood, composition style, and color palette. Do NOT reproduce the reference.\n`
    : "";

  return `You are a professional book cover designer creating covers for Amazon Kindle Direct Publishing.
${referenceClause}
Output requirements:
- Portrait orientation, 1.6:1 aspect ratio (will be cropped to 1600×2560px at 300 DPI)
- Do NOT generate any text, lettering, or typography in the image
- No watermarks, borders, or frames

Design principles:
- Compose for thumbnail legibility — the cover must read at 120px wide on Amazon
- Bold, high-contrast focal point
${typographySpacing}`;
}

const PROMPT_LABELS: Record<string, string> = {
  [REF_PROMPT_KEY]: "Additional instructions",
};

const SPECIAL_KEYS = new Set(["genre", "mood", "style"]);

/** All dynamic user data — uniform key-value format. */
export function buildAttributePrompt(
  attributes: Record<string, string | string[]>,
  title: string,
  descriptions?: DescriptionsMap,
): string {
  const genre = (attributes.genre as string) ?? "";
  const style = (attributes.style as string) ?? "";
  const mood = formatAttrValue(attributes.mood ?? []);
  const genreRules = descriptions?.genre?.[genre] ?? "";

  const parts: string[] = [];
  if (genre) parts.push(`Genre: ${categoryLabel(genre)}`);
  if (genreRules) parts.push(`Genre conventions: ${genreRules}`);
  if (style) parts.push(`Art style: ${categoryLabel(style)}`);
  if (mood) parts.push(`Mood: ${mood}`);

  const extraAttrs = Object.entries(attributes)
    .filter(([key]) => !SPECIAL_KEYS.has(key))
    .filter(([, val]) => val !== "" && !(Array.isArray(val) && val.length === 0))
    .map(([key, val]) => `${PROMPT_LABELS[key] ?? categoryLabel(key)}: ${formatAttrValue(val)}`);
  parts.push(...extraAttrs);

  return parts.join("\n");
}

