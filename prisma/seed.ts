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
}

interface SeedCategory {
  id: string;
  name: string;
  type: string;
  builtIn: boolean;
  enabled: boolean;
  description: string;
  values: SeedValue[];
}

const DEFAULT_CONFIG: { categories: SeedCategory[] } = {
  categories: [
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
  ],
};

/** Build a lookup of default values by categoryId → value slug */
function buildDefaultLookup(): Map<string, Map<string, SeedValue>> {
  const result = new Map<string, Map<string, SeedValue>>();
  for (const cat of DEFAULT_CONFIG.categories) {
    result.set(cat.id, new Map(cat.values.map((v) => [v.value, v])));
  }
  return result;
}

/**
 * Ensure a config has all built-in categories, values, and descriptions.
 * Mirrors ensureBuiltInCategories() from src/lib/attributes.ts but
 * operates on plain objects since we can't import app code.
 */
function ensureDefaults(config: { categories: SeedCategory[] }): {
  config: { categories: SeedCategory[] };
  changed: boolean;
} {
  const defaultLookup = buildDefaultLookup();
  const defaultCats = new Map(DEFAULT_CONFIG.categories.map((c) => [c.id, c]));
  let changed = false;

  const categories = config.categories.map((cat) => {
    const defaultCat = defaultCats.get(cat.id);
    let description = cat.description;
    if (!description && defaultCat?.description) {
      description = defaultCat.description;
      changed = true;
    }

    const valLookup = defaultLookup.get(cat.id);
    let values = cat.values.map((v) => {
      if (!v.description && v.builtIn && valLookup) {
        const def = valLookup.get(v.value);
        if (def?.description) {
          changed = true;
          return { ...v, description: def.description };
        }
      }
      return v;
    });

    // Add missing built-in values
    if (valLookup) {
      const existing = new Set(values.map((v) => v.value));
      const missing = defaultCat?.values.filter((v) => !existing.has(v.value)) ?? [];
      if (missing.length > 0) {
        changed = true;
        values = [...values, ...missing];
      }
    }

    if (description !== cat.description || values !== cat.values) {
      return { ...cat, description, values };
    }
    return cat;
  });

  // Add missing built-in categories
  const existingIds = new Set(categories.map((c) => c.id));
  const missingCats = DEFAULT_CONFIG.categories.filter((c) => !existingIds.has(c.id));
  if (missingCats.length > 0) changed = true;

  return {
    config: {
      categories: missingCats.length > 0 ? [...categories, ...missingCats] : categories,
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
        record.config as unknown as { categories: SeedCategory[] },
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
