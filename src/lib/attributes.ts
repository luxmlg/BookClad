import { GENRES, MOODS, ART_STYLES, GENRE_VISUAL_RULES } from "./constants";

// ── Types ────────────────────────────────────────────────────────

export interface AttributeValue {
  value: string;
  label: string;
  builtIn: boolean;
  visualRule?: string;
}

export interface AttributeCategory {
  id: string;
  name: string;
  type: "single" | "multi";
  builtIn: boolean;
  enabled: boolean;
  values: AttributeValue[];
}

export interface AttributeConfigJson {
  categories: AttributeCategory[];
}

/** Per-project selections: category id → selected value(s) */
export type AttributeSelection = Record<string, string | string[]>;

// ── Defaults ─────────────────────────────────────────────────────

export function buildDefaultConfig(): AttributeConfigJson {
  return {
    categories: [
      {
        id: "genre",
        name: "Genre",
        type: "single",
        builtIn: true,
        enabled: true,
        values: GENRES.map((g) => ({
          value: g.value,
          label: g.label,
          builtIn: true,
          visualRule: GENRE_VISUAL_RULES[g.value],
        })),
      },
      {
        id: "mood",
        name: "Mood",
        type: "multi",
        builtIn: true,
        enabled: true,
        values: MOODS.map((m) => ({
          value: m,
          label: m,
          builtIn: true,
        })),
      },
      {
        id: "style",
        name: "Art Style",
        type: "single",
        builtIn: true,
        enabled: true,
        values: ART_STYLES.map((s) => ({
          value: s.value,
          label: s.label,
          builtIn: true,
        })),
      },
    ],
  };
}

/** Merge new built-in values into an existing user config. */
export function mergeWithDefaults(
  userConfig: AttributeConfigJson
): AttributeConfigJson {
  const defaults = buildDefaultConfig();
  const merged = { ...userConfig, categories: [...userConfig.categories] };

  for (const defaultCat of defaults.categories) {
    const existing = merged.categories.find((c) => c.id === defaultCat.id);
    if (!existing) {
      // New built-in category added since user created their config
      merged.categories.push(defaultCat);
    } else {
      // Merge any new built-in values
      for (const dv of defaultCat.values) {
        if (!existing.values.some((v) => v.value === dv.value)) {
          existing.values.push(dv);
        }
      }
    }
  }

  return merged;
}

/** Get the visual rule string for a given attribute value. */
export function getVisualRule(
  config: AttributeConfigJson,
  categoryId: string,
  value: string
): string | undefined {
  const cat = config.categories.find((c) => c.id === categoryId);
  return cat?.values.find((v) => v.value === value)?.visualRule;
}

/** Build default attribute selection (first value of each enabled single, empty array for multi). */
export function buildDefaultSelection(
  config: AttributeConfigJson
): AttributeSelection {
  const selection: AttributeSelection = {};
  for (const cat of config.categories) {
    if (!cat.enabled) continue;
    if (cat.type === "single") {
      selection[cat.id] = cat.values[0]?.value ?? "";
    } else {
      selection[cat.id] = [];
    }
  }
  return selection;
}
