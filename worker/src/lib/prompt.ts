// Intentional duplication of GENRE_VISUAL_RULES from src/lib/constants.ts and
// formatAttrValue from src/lib/attributes.ts — the worker is a separate package
// and cannot import from src/.
export const GENRE_VISUAL_RULES: Record<string, string> = {
  thriller:
    "High contrast, desaturated palette, single dominant silhouette or object, dramatic shadow",
  romance:
    "Warm/rose tones, soft focus, figures (if any) in close proximity, bokeh background",
  "epic-fantasy":
    "Wide establishing shot, sense of scale, glowing magical elements, deep sky",
  "urban-fantasy":
    "City skyline with magical elements, neon or twilight palette, single figure in foreground",
  "cozy-fantasy":
    "Warm interior or cottage scene, soft lighting, magical whimsy, comfortable palette",
  "sci-fi":
    "Futuristic setting, cool blue/teal palette, technology or space elements, dramatic lighting",
  horror:
    "Low key lighting, desaturated with single accent color (red/sickly green), isolation/dread",
  "cozy-mystery":
    "Illustrated style, warm colors, small-town or domestic setting, cat/teacup motif",
  "self-help":
    "Clean geometric layout, bold typography-friendly negative space, professional palette",
  business:
    "Sleek modern aesthetic, confident palette, abstract geometric shapes or city imagery",
  childrens:
    "Bright vivid colors, playful illustrated style, friendly characters, whimsical elements",
  "literary-fiction":
    "Understated, moody, artistic composition with symbolic imagery and muted tones",
};

interface ProjectBrief {
  attributes: Record<string, string | string[]>;
  brief: string | null;
  title: string;
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

/** All dynamic user data — uniform key-value format. */
export function buildAttributePrompt(project: ProjectBrief): string {
  const attrs = project.attributes;
  const genre = (attrs.genre as string) ?? "";
  const style = (attrs.style as string) ?? "";
  const mood = formatAttrValue(attrs.mood ?? []);
  const genreRules = GENRE_VISUAL_RULES[genre] ?? "";

  const parts: string[] = [];
  if (genre) parts.push(`Genre: ${categoryLabel(genre)}`);
  if (genreRules) parts.push(`Genre conventions: ${genreRules}`);
  if (style) parts.push(`Art style: ${categoryLabel(style)}`);
  if (mood) parts.push(`Mood: ${mood}`);

  const extraAttrs = Object.entries(attrs)
    .filter(([key]) => !["genre", "mood", "style"].includes(key))
    .map(([key, val]) => `${categoryLabel(key)}: ${formatAttrValue(val)}`);
  parts.push(...extraAttrs);

  if (project.brief) parts.push(`Visual elements: ${project.brief}`);

  return parts.join("\n");
}

