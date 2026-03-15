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
  type: "single" | "multi" | "text" | "toggle" | "scale" | "color";
  builtIn: boolean;
  enabled: boolean;
  values: AttributeValue[];
  scaleLabels?: { min: string; max: string };
}

export interface AttributeConfigJson {
  categories: AttributeCategory[];
  /** Index among enabled categories where the brief/prompt textarea appears. */
  briefPosition?: number;
}

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
