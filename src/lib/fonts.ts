export type FontCategory = "serif" | "sans-serif" | "display" | "monospace";

export interface FontDefinition {
  family: string;
  category: FontCategory;
}

export const FONTS: FontDefinition[] = [
  // Serif
  { family: "Playfair Display", category: "serif" },
  { family: "Merriweather", category: "serif" },
  { family: "Lora", category: "serif" },
  { family: "Libre Baskerville", category: "serif" },
  { family: "Cormorant Garamond", category: "serif" },
  { family: "EB Garamond", category: "serif" },
  { family: "Crimson Text", category: "serif" },
  { family: "Source Serif 4", category: "serif" },
  { family: "Abril Fatface", category: "serif" },
  { family: "Cinzel", category: "serif" },
  // Sans-Serif
  { family: "Montserrat", category: "sans-serif" },
  { family: "Raleway", category: "sans-serif" },
  { family: "Open Sans", category: "sans-serif" },
  { family: "Lato", category: "sans-serif" },
  { family: "Oswald", category: "sans-serif" },
  { family: "Poppins", category: "sans-serif" },
  { family: "Inter", category: "sans-serif" },
  { family: "Nunito", category: "sans-serif" },
  { family: "Work Sans", category: "sans-serif" },
  { family: "Bebas Neue", category: "sans-serif" },
  // Display & Script
  { family: "Dancing Script", category: "display" },
  { family: "Pacifico", category: "display" },
  { family: "Great Vibes", category: "display" },
  { family: "Caveat", category: "display" },
  { family: "Righteous", category: "display" },
  // Monospace
  { family: "Roboto Mono", category: "monospace" },
  { family: "Source Code Pro", category: "monospace" },
];

const FONT_MIGRATION_MAP: Record<string, string> = {
  "Georgia, serif": "Playfair Display",
  "Times New Roman, serif": "Libre Baskerville",
  "Garamond, serif": "Cormorant Garamond",
  "Palatino, serif": "Source Serif 4",
  "Helvetica, sans-serif": "Montserrat",
  "Arial, sans-serif": "Open Sans",
  "Futura, sans-serif": "Poppins",
  "Verdana, sans-serif": "Nunito",
  "Courier New, monospace": "Roboto Mono",
  "Impact, sans-serif": "Righteous",
};

export function migrateFont(fontFamily: string): string {
  return FONT_MIGRATION_MAP[fontFamily] ?? fontFamily;
}

export async function ensureFontLoaded(family: string): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    await document.fonts.load(`1px "${family}"`);
    return document.fonts.check(`1px "${family}"`);
  } catch {
    return false;
  }
}

const CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: "Serif",
  "sans-serif": "Sans-Serif",
  display: "Display & Script",
  monospace: "Monospace",
};

export const FONTS_BY_CATEGORY = (
  Object.keys(CATEGORY_LABELS) as FontCategory[]
).map((category) => ({
  category,
  label: CATEGORY_LABELS[category],
  fonts: FONTS.filter((f) => f.category === category),
}));

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  FONTS.map((f) => `family=${f.family.replace(/ /g, "+")}:wght@400;700`).join(
    "&"
  ) +
  "&display=swap";
