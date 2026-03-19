import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Inline the default config so the seed has zero app imports and can run standalone.
// Keep in sync with buildDefaultConfig() in src/lib/attributes.ts.

interface SeedValue {
  value: string;
  label: string;
  builtIn: boolean;
  description: string;
  disabled?: boolean;
  colors?: string[];
}

interface SeedAttribute {
  id: string;
  name: string;
  type: string;
  builtIn: boolean;
  enabled: boolean;
  description: string;
  values: SeedValue[];
}

const DEFAULT_CONFIG: { attributes: SeedAttribute[] } = {
  attributes: [
    {
      id: "genre",
      name: "Genre",
      type: "single",
      builtIn: true,
      enabled: true,
      description: "The book's genre shapes the overall visual language — color palette, composition, and subject matter",
      values: [
        { value: "thriller", label: "Thriller / Mystery", builtIn: true, description: "High contrast, desaturated palette, single dominant silhouette or object, dramatic shadow" },
        { value: "romance", label: "Romance", builtIn: true, description: "Warm/rose tones, soft focus, figures (if any) in close proximity, bokeh background" },
        { value: "epic-fantasy", label: "Epic Fantasy", builtIn: true, description: "Wide establishing shot, sense of scale, glowing magical elements, deep sky" },
        { value: "urban-fantasy", label: "Urban Fantasy", builtIn: true, description: "City skyline with magical elements, neon or twilight palette, single figure in foreground" },
        { value: "cozy-fantasy", label: "Cozy Fantasy", builtIn: true, description: "Warm interior or cottage scene, soft lighting, magical whimsy, comfortable palette" },
        { value: "sci-fi", label: "Sci-Fi", builtIn: true, description: "Futuristic setting, cool blue/teal palette, technology or space elements, dramatic lighting" },
        { value: "horror", label: "Horror", builtIn: true, description: "Low key lighting, desaturated with single accent color (red/sickly green), isolation/dread" },
        { value: "cozy-mystery", label: "Cozy Mystery", builtIn: true, description: "Illustrated style, warm colors, small-town or domestic setting, cat/teacup motif" },
        { value: "self-help", label: "Self-Help / Non-Fiction", builtIn: true, description: "Clean geometric layout, bold typography-friendly negative space, professional palette" },
        { value: "business", label: "Business", builtIn: true, description: "Sleek modern aesthetic, confident palette, abstract geometric shapes or city imagery" },
        { value: "childrens", label: "Children's / YA", builtIn: true, description: "Bright vivid colors, playful illustrated style, friendly characters, whimsical elements" },
        { value: "literary-fiction", label: "Literary Fiction", builtIn: true, description: "Understated, moody, artistic composition with symbolic imagery and muted tones" },
      ],
    },
    {
      id: "mood",
      name: "Mood",
      type: "multi",
      builtIn: true,
      enabled: true,
      description: "Mood overlays emotional tone onto the cover through lighting, contrast, and atmosphere",
      values: [
        { value: "dark", label: "dark", builtIn: true, description: "Deep shadows, muted colors, sense of foreboding or moral ambiguity" },
        { value: "whimsical", label: "whimsical", builtIn: true, description: "Playful shapes, bright accents, lighthearted and imaginative feel" },
        { value: "epic", label: "epic", builtIn: true, description: "Grand scale, sweeping vistas, dramatic lighting conveying magnitude" },
        { value: "intellectual", label: "intellectual", builtIn: true, description: "Clean lines, restrained palette, cerebral and contemplative mood" },
        { value: "romantic", label: "romantic", builtIn: true, description: "Soft warm tones, gentle lighting, intimacy and emotional warmth" },
        { value: "suspenseful", label: "suspenseful", builtIn: true, description: "Tension through contrast, obscured details, edge-of-seat atmosphere" },
        { value: "hopeful", label: "hopeful", builtIn: true, description: "Rising light, warm gradients, uplifting and optimistic energy" },
        { value: "eerie", label: "eerie", builtIn: true, description: "Unsettling stillness, off-kilter composition, subtle wrongness" },
        { value: "adventurous", label: "adventurous", builtIn: true, description: "Dynamic angles, vivid colors, sense of motion and discovery" },
        { value: "serene", label: "serene", builtIn: true, description: "Soft focus, pastel or cool tones, calm and meditative atmosphere" },
        { value: "gritty", label: "gritty", builtIn: true, description: "Rough textures, desaturated earth tones, raw and unpolished feel" },
        { value: "playful", label: "playful", builtIn: true, description: "Bright saturated colors, rounded shapes, fun and energetic vibe" },
      ],
    },
    {
      id: "style",
      name: "Art Style",
      type: "single",
      builtIn: true,
      enabled: true,
      description: "Art style determines the rendering technique — from photorealistic to abstract",
      values: [
        { value: "photorealistic", label: "Photorealistic", builtIn: true, description: "Camera-quality imagery with natural lighting, depth of field, and realistic textures" },
        { value: "illustrated", label: "Illustrated", builtIn: true, description: "Hand-drawn or digital illustration style with visible artistic strokes and stylization" },
        { value: "painterly", label: "Painterly", builtIn: true, description: "Oil or acrylic painting aesthetic with visible brushwork, rich color mixing, and texture" },
        { value: "minimalist", label: "Minimalist", builtIn: true, description: "Stripped-down composition with maximum negative space, simple shapes, and limited palette" },
        { value: "typographic", label: "Typographic", builtIn: true, description: "Typography as the primary visual element, creative letterforms, text-driven layout" },
      ],
    },
    {
      id: "visual-elements",
      name: "Visual Elements",
      type: "text",
      builtIn: true,
      enabled: true,
      description: "Specific objects, symbols, or scene details to include in the cover image",
      values: [],
    },
    {
      id: "color-palette",
      name: "Color Palette",
      type: "palette",
      builtIn: true,
      enabled: false,
      description: "A curated set of colors that guides the overall palette of the cover image",
      values: [
        { value: "dark-moody", label: "Dark & Moody", builtIn: true, description: "Deep shadows and high contrast with a blood-red accent. Thriller, horror, dark fantasy.", colors: ["#0a0a0f", "#1a1a2e", "#2d1b3d", "#8b0000", "#d4d4d4"] },
        { value: "warm-inviting", label: "Warm & Inviting", builtIn: true, description: "Soft golds, ambers, and cream. Romance, cozy fiction, warm-hearted stories.", colors: ["#8b4513", "#cd853f", "#daa520", "#ffd700", "#fff8dc"] },
        { value: "cool-ethereal", label: "Cool & Ethereal", builtIn: true, description: "Icy blues, slate, and silver. Sci-fi, mystery, literary fiction.", colors: ["#0d1b2a", "#1b2838", "#415a77", "#778da9", "#e0e1dd"] },
        { value: "vibrant-bold", label: "Vibrant & Bold", builtIn: true, description: "Saturated, eye-catching contrasts. Children's, YA, action-adventure.", colors: ["#e63946", "#f77f00", "#fcbf49", "#2a9d8f", "#264653"] },
        { value: "earth-stone", label: "Earth & Stone", builtIn: true, description: "Natural browns, tans, and warm grays. Literary fiction, historical, memoir.", colors: ["#3d2b1f", "#5c4033", "#8b7355", "#b5a888", "#e8dcc8"] },
        { value: "pastel-soft", label: "Pastel Soft", builtIn: true, description: "Light, gentle pastels. Cozy mystery, light romance, feel-good fiction.", colors: ["#ffd1dc", "#b5ead7", "#c7ceea", "#ffdac1", "#e2f0cb"] },
        { value: "jewel-tones", label: "Jewel Tones", builtIn: true, description: "Rich, deep saturation. Epic fantasy, historical drama, opulent settings.", colors: ["#4a0e4e", "#0c2461", "#006266", "#8e1600", "#cc8e35"] },
        { value: "neon-electric", label: "Neon Electric", builtIn: true, description: "High-energy neon on dark backgrounds. Cyberpunk, tech thriller, urban sci-fi.", colors: ["#0d0221", "#0f084b", "#ff006e", "#00f5d4", "#ffbe0b"] },
        { value: "monochrome", label: "Monochrome", builtIn: true, description: "Black-to-white grayscale. Minimalist, business, literary, typographic covers.", colors: ["#0a0a0a", "#333333", "#666666", "#999999", "#f5f5f5"] },
        { value: "golden-luxe", label: "Golden Luxe", builtIn: true, description: "Premium golds against deep black. Business, self-help, luxury non-fiction.", colors: ["#1a1a1a", "#8b6914", "#daa520", "#ffd700", "#f5f0e1"] },
      ],
    },
  ],
};

/** Build a lookup of default values by attributeId → value slug */
function buildDefaultLookup(): Map<string, Map<string, SeedValue>> {
  const result = new Map<string, Map<string, SeedValue>>();
  for (const attr of DEFAULT_CONFIG.attributes) {
    result.set(attr.id, new Map(attr.values.map((v) => [v.value, v])));
  }
  return result;
}

/**
 * Ensure a config has all built-in attributes, values, and descriptions.
 * Mirrors ensureBuiltInCategories() from src/lib/attributes.ts but
 * operates on plain objects since we can't import app code.
 */
function ensureDefaults(config: { attributes: SeedAttribute[] }): {
  config: { attributes: SeedAttribute[] };
  changed: boolean;
} {
  const defaultLookup = buildDefaultLookup();
  const defaultAttrs = new Map(DEFAULT_CONFIG.attributes.map((c) => [c.id, c]));
  let changed = false;

  const attributes = config.attributes.map((attr) => {
    const defaultAttr = defaultAttrs.get(attr.id);
    let description = attr.description;
    if (!description && defaultAttr?.description) {
      description = defaultAttr.description;
      changed = true;
    }

    const valLookup = defaultLookup.get(attr.id);
    let values = attr.values.map((v) => {
      let updated = v;
      if (!v.description && v.builtIn && valLookup) {
        const def = valLookup.get(v.value);
        if (def?.description) {
          changed = true;
          updated = { ...updated, description: def.description };
        }
      }
      // Backfill missing colors from defaults
      if (!v.colors && v.builtIn && valLookup) {
        const def = valLookup.get(v.value);
        if (def?.colors) {
          changed = true;
          updated = { ...updated, colors: def.colors };
        }
      }
      if (updated !== v) return updated;
      return v;
    });

    // Add missing built-in values
    if (valLookup) {
      const existing = new Set(values.map((v) => v.value));
      const missing = defaultAttr?.values.filter((v) => !existing.has(v.value)) ?? [];
      if (missing.length > 0) {
        changed = true;
        values = [...values, ...missing];
      }
    }

    if (description !== attr.description || values !== attr.values) {
      return { ...attr, description, values };
    }
    return attr;
  });

  // Add missing built-in attributes
  const existingIds = new Set(attributes.map((c) => c.id));
  const missingAttrs = DEFAULT_CONFIG.attributes.filter((c) => !existingIds.has(c.id));
  if (missingAttrs.length > 0) changed = true;

  return {
    config: {
      attributes: missingAttrs.length > 0 ? [...attributes, ...missingAttrs] : attributes,
    },
    changed,
  };
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Create configs for users who don't have one
    const usersWithoutConfig = await prisma.user.findMany({
      where: { attributeConfig: null },
      select: { id: true },
    });

    if (usersWithoutConfig.length > 0) {
      const created = await prisma.attributeConfig.createMany({
        data: usersWithoutConfig.map((u) => ({
          userId: u.id,
          config: DEFAULT_CONFIG as unknown as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      console.log(`Created attribute configs for ${created.count} users.`);
    }

    // 2. Backfill existing configs with missing built-in values/descriptions
    const allConfigs = await prisma.attributeConfig.findMany();
    let updated = 0;

    for (const record of allConfigs) {
      const { config, changed } = ensureDefaults(
        record.config as unknown as { attributes: SeedAttribute[] },
      );
      if (changed) {
        await prisma.attributeConfig.update({
          where: { id: record.id },
          data: { config: config as unknown as Prisma.InputJsonValue },
        });
        updated++;
      }
    }

    if (updated > 0) {
      console.log(`Updated ${updated} existing configs with missing defaults.`);
    }

    if (usersWithoutConfig.length === 0 && updated === 0) {
      console.log("Nothing to seed — all configs are up to date.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
