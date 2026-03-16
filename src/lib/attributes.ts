import { GENRES, MOODS, ART_STYLES } from "./constants";

// ── Types ────────────────────────────────────────────────────────

export interface AttributeValue {
  value: string;
  label: string;
  builtIn: boolean;
  description?: string;
  disabled?: boolean;
}

export interface AttributeCategory {
  id: string;
  name: string;
  type: "single" | "multi" | "text" | "toggle" | "scale" | "color";
  builtIn: boolean;
  enabled: boolean;
  description?: string;
  values: AttributeValue[];
  scaleLabels?: { min: string; max: string };
}

export interface AttributeConfigJson {
  categories: AttributeCategory[];
}

export const REF_PROMPT_KEY = "ref-instructions";

/** Per-project selections: category id → selected value(s) */
export type AttributeSelection = Record<string, string | string[]>;

// ── Utilities ───────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Get the default selection value for a given attribute type. */
export function getDefaultValue(
  type: AttributeCategory["type"],
  firstValue?: string,
): string | string[] {
  switch (type) {
    case "multi":
      return [];
    case "toggle":
      return "false";
    case "scale":
      return "5";
    case "color":
      return "#6366f1";
    case "single":
      return firstValue ?? "";
    case "text":
      return "";
  }
}

/** Format a single attribute value for display (true→yes, false→no, array→comma-joined). */
export function formatAttrValue(val: string | string[]): string {
  if (Array.isArray(val)) return val.join(", ");
  if (val === "true") return "yes";
  if (val === "false") return "no";
  return val;
}

/** Format an attribute snapshot as a human-readable string. */
export function formatAttributes(
  snapshot: Record<string, string | string[]>,
): string {
  return Object.entries(snapshot)
    .map(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return `${label}: ${formatAttrValue(val)}`;
    })
    .join(" · ");
}

export interface AttributeDiff {
  key: string;
  label: string;
  added: string[];
  removed: string[];
  kept: string[];
}

/** Compute the set-based diff between two attribute snapshots. */
export function computeAttributeDiff(
  current: Record<string, string | string[]> | null | undefined,
  previous: Record<string, string | string[]> | null | undefined,
): AttributeDiff[] | null {
  if (!current || !previous) return null;

  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const diffs: AttributeDiff[] = [];

  for (const key of allKeys) {
    const toArr = (val: string | string[] | undefined): string[] => {
      if (val === undefined || val === "") return [];
      return Array.isArray(val) ? val : [val];
    };

    const curArr = toArr(current[key]);
    const prevArr = toArr(previous[key]);
    const curSet = new Set(curArr);
    const prevSet = new Set(prevArr);

    const added = curArr.filter((v) => !prevSet.has(v));
    const removed = prevArr.filter((v) => !curSet.has(v));
    const kept = curArr.filter((v) => prevSet.has(v));

    if (added.length > 0 || removed.length > 0) {
      diffs.push({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        added,
        removed,
        kept,
      });
    }
  }

  return diffs.length > 0 ? diffs : null;
}

/** Add a custom value to a category in the config. */
export function addValueToCategory(
  config: AttributeConfigJson,
  categoryId: string,
  value: string,
  label: string,
): AttributeConfigJson {
  return {
    ...config,
    categories: config.categories.map((c) =>
      c.id === categoryId
        ? { ...c, values: [...c.values, { value, label, builtIn: false }] }
        : c,
    ),
  };
}

/** Remove a custom value from a category in the config. */
export function removeValueFromCategory(
  config: AttributeConfigJson,
  categoryId: string,
  value: string,
): AttributeConfigJson {
  return {
    ...config,
    categories: config.categories.map((c) =>
      c.id === categoryId
        ? {
            ...c,
            values: c.values.filter((v) => v.value !== value || v.builtIn),
          }
        : c,
    ),
  };
}

// ── Defaults ─────────────────────────────────────────────────────

export function buildDefaultConfig(): AttributeConfigJson {
  // Seed descriptions — only used when creating a new user's config or restoring defaults.
  // Once saved to DB, the DB copy is the source of truth.
  const genreDescs: Record<string, string> = {
    thriller: "High contrast, desaturated palette, single dominant silhouette or object, dramatic shadow",
    romance: "Warm/rose tones, soft focus, figures (if any) in close proximity, bokeh background",
    "epic-fantasy": "Wide establishing shot, sense of scale, glowing magical elements, deep sky",
    "urban-fantasy": "City skyline with magical elements, neon or twilight palette, single figure in foreground",
    "cozy-fantasy": "Warm interior or cottage scene, soft lighting, magical whimsy, comfortable palette",
    "sci-fi": "Futuristic setting, cool blue/teal palette, technology or space elements, dramatic lighting",
    horror: "Low key lighting, desaturated with single accent color (red/sickly green), isolation/dread",
    "cozy-mystery": "Illustrated style, warm colors, small-town or domestic setting, cat/teacup motif",
    "self-help": "Clean geometric layout, bold typography-friendly negative space, professional palette",
    business: "Sleek modern aesthetic, confident palette, abstract geometric shapes or city imagery",
    childrens: "Bright vivid colors, playful illustrated style, friendly characters, whimsical elements",
    "literary-fiction": "Understated, moody, artistic composition with symbolic imagery and muted tones",
  };

  const moodDescs: Record<string, string> = {
    dark: "Deep shadows, muted colors, sense of foreboding or moral ambiguity",
    whimsical: "Playful shapes, bright accents, lighthearted and imaginative feel",
    epic: "Grand scale, sweeping vistas, dramatic lighting conveying magnitude",
    intellectual: "Clean lines, restrained palette, cerebral and contemplative mood",
    romantic: "Soft warm tones, gentle lighting, intimacy and emotional warmth",
    suspenseful: "Tension through contrast, obscured details, edge-of-seat atmosphere",
    hopeful: "Rising light, warm gradients, uplifting and optimistic energy",
    eerie: "Unsettling stillness, off-kilter composition, subtle wrongness",
    adventurous: "Dynamic angles, vivid colors, sense of motion and discovery",
    serene: "Soft focus, pastel or cool tones, calm and meditative atmosphere",
    gritty: "Rough textures, desaturated earth tones, raw and unpolished feel",
    playful: "Bright saturated colors, rounded shapes, fun and energetic vibe",
  };

  const styleDescs: Record<string, string> = {
    photorealistic: "Camera-quality imagery with natural lighting, depth of field, and realistic textures",
    illustrated: "Hand-drawn or digital illustration style with visible artistic strokes and stylization",
    painterly: "Oil or acrylic painting aesthetic with visible brushwork, rich color mixing, and texture",
    minimalist: "Stripped-down composition with maximum negative space, simple shapes, and limited palette",
    typographic: "Typography as the primary visual element, creative letterforms, text-driven layout",
  };

  return {
    categories: [
      {
        id: "genre",
        name: "Genre",
        type: "single",
        builtIn: true,
        enabled: true,
        description: "The book's genre shapes the overall visual language — color palette, composition, and subject matter",
        values: GENRES.map((g) => ({
          value: g.value,
          label: g.label,
          builtIn: true,
          description: genreDescs[g.value],
        })),
      },
      {
        id: "mood",
        name: "Mood",
        type: "multi",
        builtIn: true,
        enabled: true,
        description: "Mood overlays emotional tone onto the cover through lighting, contrast, and atmosphere",
        values: MOODS.map((m) => ({
          value: m,
          label: m,
          builtIn: true,
          description: moodDescs[m],
        })),
      },
      {
        id: "style",
        name: "Art Style",
        type: "single",
        builtIn: true,
        enabled: true,
        description: "Art style determines the rendering technique — from photorealistic to abstract",
        values: ART_STYLES.map((s) => ({
          value: s.value,
          label: s.label,
          builtIn: true,
          description: styleDescs[s.value],
        })),
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
}

/** Get the description string for a given attribute value. */
export function getDescription(
  config: AttributeConfigJson,
  categoryId: string,
  value: string,
): string | undefined {
  const cat = config.categories.find((c) => c.id === categoryId);
  return cat?.values.find((v) => v.value === value)?.description;
}

/** Return only active (non-disabled) values for a category. */
export function getActiveValues(category: AttributeCategory): AttributeValue[] {
  return category.values.filter((v) => !v.disabled);
}

/** Update a value's properties (description, disabled) within a category. */
export function updateValueInCategory(
  config: AttributeConfigJson,
  categoryId: string,
  value: string,
  updates: Partial<Pick<AttributeValue, "description" | "disabled">>,
): AttributeConfigJson {
  return {
    ...config,
    categories: config.categories.map((c) =>
      c.id === categoryId
        ? {
            ...c,
            values: c.values.map((v) =>
              v.value === value ? { ...v, ...updates } : v,
            ),
          }
        : c,
    ),
  };
}

/** Update a category's description. */
export function updateCategoryDescription(
  config: AttributeConfigJson,
  categoryId: string,
  description: string,
): AttributeConfigJson {
  return {
    ...config,
    categories: config.categories.map((c) =>
      c.id === categoryId ? { ...c, description } : c,
    ),
  };
}

/** Look up the default description for a built-in value from buildDefaultConfig(). */
export function getDefaultDescription(
  categoryId: string,
  value: string,
): string | undefined {
  const defaults = buildDefaultConfig();
  const cat = defaults.categories.find((c) => c.id === categoryId);
  return cat?.values.find((v) => v.value === value)?.description;
}

/** Look up the default description for a built-in category from buildDefaultConfig(). */
export function getDefaultCategoryDescription(
  categoryId: string,
): string | undefined {
  const defaults = buildDefaultConfig();
  return defaults.categories.find((c) => c.id === categoryId)?.description;
}

/** Build default attribute selection for all enabled categories. */
export function buildDefaultSelection(
  config: AttributeConfigJson,
): AttributeSelection {
  const selection: AttributeSelection = {};
  for (const cat of config.categories) {
    if (!cat.enabled) continue;
    selection[cat.id] = getDefaultValue(cat.type, cat.values[0]?.value);
  }
  return selection;
}

/**
 * Ensure existing configs have all built-in categories/values and
 * that descriptions are populated. Handles:
 * - Backfilling missing value descriptions from defaults
 * - Backfilling missing category-level descriptions
 * - Adding missing built-in values to existing categories
 * - Adding entirely missing built-in categories
 */
export function ensureBuiltInCategories(
  config: AttributeConfigJson,
): AttributeConfigJson {
  const defaults = buildDefaultConfig();
  const defaultsByCategory = new Map(
    defaults.categories.map((c) => [c.id, c]),
  );

  let changed = false;
  const categories = config.categories.map((cat) => {
    const defaultCat = defaultsByCategory.get(cat.id);

    // Backfill category description
    let description = cat.description;
    if (!description && defaultCat?.description) {
      description = defaultCat.description;
      changed = true;
    }

    // Build lookup for default values
    const defaultValuesMap = new Map(
      defaultCat?.values.map((v) => [v.value, v]) ?? [],
    );

    let values = cat.values.map((v) => {
      // Backfill missing description from defaults
      if (!v.description && v.builtIn) {
        const defaultVal = defaultValuesMap.get(v.value);
        if (defaultVal?.description) {
          changed = true;
          return { ...v, description: defaultVal.description };
        }
      }

      return v;
    });

    // Add missing built-in values to existing categories
    if (defaultCat) {
      const existingValues = new Set(values.map((v) => v.value));
      const missingValues = defaultCat.values.filter(
        (v) => !existingValues.has(v.value),
      );
      if (missingValues.length > 0) {
        changed = true;
        values = [...values, ...missingValues];
      }
    }

    if (description !== cat.description || values !== cat.values) {
      return { ...cat, description, values };
    }
    return cat;
  });

  // Add entirely missing built-in categories
  const existingIds = new Set(categories.map((c) => c.id));
  const missing = defaults.categories.filter((c) => !existingIds.has(c.id));
  if (missing.length > 0) {
    changed = true;
  }

  if (!changed && missing.length === 0) return config;
  return {
    ...config,
    categories: missing.length > 0 ? [...categories, ...missing] : categories,
  };
}
