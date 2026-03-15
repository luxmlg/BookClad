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

function formatAttrValue(val: string | string[]): string {
  if (Array.isArray(val)) return val.join(", ");
  if (val === "true") return "yes";
  if (val === "false") return "no";
  return val;
}

function categoryLabel(key: string): string {
  return key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildPrompt(project: ProjectBrief): string {
  const attrs = project.attributes;
  const genre = (attrs.genre as string) ?? "";
  const style = (attrs.style as string) ?? "";
  const mood = formatAttrValue(attrs.mood ?? []);
  const genreRules = GENRE_VISUAL_RULES[genre] ?? "";

  const extraAttrs = Object.entries(attrs)
    .filter(([key]) => !["genre", "mood", "style"].includes(key))
    .map(([key, val]) => `- ${categoryLabel(key)}: ${formatAttrValue(val)}`)
    .join("\n");

  return `You are a professional book cover designer specializing in ${genre} covers for Amazon Kindle.

Create a ${style} book cover image with the following specifications:
- Canvas: Portrait orientation, 1.6:1 aspect ratio (will be cropped to exact dimensions later)
${genreRules ? `- Genre conventions: ${genreRules}\n` : ""}- Mood: ${mood}
${extraAttrs ? extraAttrs + "\n" : ""}- Key visual elements: ${project.brief ?? "Use genre-typical imagery"}
- Leave clear, uncluttered space in the upper third for the title text
- Leave clear space in the lower fifth for the author name
- Color palette: Derived from the genre and mood
- NO text, NO watermarks, NO borders in the generated image

The cover must look competitive on the Amazon bestseller page for ${genre}. It should immediately communicate the book's theme to a browsing reader in thumbnail size.`;
}

export function buildReferencePrompt(project: ProjectBrief): string {
  const attrs = project.attributes;
  const genre = (attrs.genre as string) ?? "";
  const style = (attrs.style as string) ?? "";
  const mood = formatAttrValue(attrs.mood ?? []);
  const genreRules = GENRE_VISUAL_RULES[genre] ?? "";

  const extraAttrs = Object.entries(attrs)
    .filter(([key]) => !["genre", "mood", "style"].includes(key))
    .map(([key, val]) => `- ${categoryLabel(key)}: ${formatAttrValue(val)}`)
    .join("\n");

  return `You are a professional book cover designer. I am providing a reference book cover image. Create a new variation inspired by this reference, keeping the same visual mood, composition style, and color palette, but creating an original image.

Specifications:
- Genre: ${genre}${genreRules ? ` (${genreRules})` : ""}
- Art style: ${style}
- Mood: ${mood}
${extraAttrs ? extraAttrs + "\n" : ""}- Key visual elements: ${project.brief ?? "Follow the reference image's theme"}
- Maintain portrait orientation, 1.6:1 aspect ratio
- Leave clear space in the upper third for title and lower fifth for author name
- NO text, NO watermarks, NO borders
- Do NOT reproduce the reference — create something new that matches its energy and feel`;
}
