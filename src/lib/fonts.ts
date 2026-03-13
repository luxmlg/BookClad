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

// Custom font registry: family → URL (for fonts loaded via FontFace API)
const customFontUrls = new Map<string, string>();

export function registerCustomFont(family: string, url: string) {
  customFontUrls.set(family, url);
}

export async function loadCustomFont(family: string, url: string): Promise<boolean> {
  if (typeof document === "undefined") return false;
  // Don't use document.fonts.check() — it returns true vacuously for unknown font families
  for (const face of document.fonts) {
    if (face.family === family && face.status === "loaded") return true;
  }
  try {
    const fontFace = new FontFace(family, `url(${url})`);
    const loaded = await fontFace.load();
    document.fonts.add(loaded);
    registerCustomFont(family, url);
    return true;
  } catch {
    return false;
  }
}

export async function ensureFontLoaded(family: string): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    // Check if already loaded via FontFace entries
    for (const face of document.fonts) {
      if (face.family === family && face.status === "loaded") return true;
    }
    // Try loading via CSS (Google Fonts — has @font-face rules from <link> tag)
    await document.fonts.load(`1px "${family}"`);
    // After load(), check entries again (not check() which is vacuously true)
    for (const face of document.fonts) {
      if (face.family === family && face.status === "loaded") return true;
    }
    // Fall back to custom font registry
    const url = customFontUrls.get(family);
    if (url) return loadCustomFont(family, url);
    return false;
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
