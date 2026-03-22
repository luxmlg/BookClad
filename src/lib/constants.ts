export const GENRES = [
  { value: "thriller", label: "Thriller / Mystery" },
  { value: "romance", label: "Romance" },
  { value: "epic-fantasy", label: "Epic Fantasy" },
  { value: "urban-fantasy", label: "Urban Fantasy" },
  { value: "cozy-fantasy", label: "Cozy Fantasy" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "horror", label: "Horror" },
  { value: "cozy-mystery", label: "Cozy Mystery" },
  { value: "self-help", label: "Self-Help / Non-Fiction" },
  { value: "business", label: "Business" },
  { value: "childrens", label: "Children's / YA" },
  { value: "literary-fiction", label: "Literary Fiction" },
] as const;

export const MOODS = [
  "dark",
  "whimsical",
  "epic",
  "intellectual",
  "romantic",
  "suspenseful",
  "hopeful",
  "eerie",
  "adventurous",
  "serene",
  "gritty",
  "playful",
] as const;

export const ART_STYLES = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "illustrated", label: "Illustrated" },
  { value: "painterly", label: "Painterly" },
  { value: "minimalist", label: "Minimalist" },
  { value: "typographic", label: "Typographic" },
] as const;

export const GENERATION_STATUS = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS];

export const JOB_TYPE = {
  GENERATE: "generate",
  INPAINT: "inpaint",
  GENERATE_FROM_REFERENCE: "generate-from-reference",
} as const;
export type JobType = typeof JOB_TYPE[keyof typeof JOB_TYPE];

export const CREDIT_COST_PER_IMAGE: Record<string, number> = {
  quick: 2,
  detailed: 3,
  premium: 5,
};

export const AI_FILL_CREDIT_COST = 1;
export const AI_FILL_PROMPT_MAX_LENGTH = 1000;

export const TIER_CREDITS: Record<string, number> = {
  FREE: 25,
  STARTER: 100,
  PRO: 250,
};

export const AI_MODELS = [
  {
    value: "quick",
    label: "Quick",
    description:
      "Fast and efficient cover generation. Best for rapid iteration and quickly exploring different design directions.",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
    creditCost: CREDIT_COST_PER_IMAGE.quick,
  },
  {
    value: "detailed",
    label: "Detailed",
    description:
      "Recommended for most covers. High-efficiency generation with improved consistency and detail — the best balance of speed, quality, and cost.",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
    creditCost: CREDIT_COST_PER_IMAGE.detailed,
  },
  {
    value: "premium",
    label: "Premium",
    description:
      "Professional-grade cover generation with advanced reasoning. Excels at following complex instructions and rendering high-fidelity text and intricate details.",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
    creditCost: CREDIT_COST_PER_IMAGE.premium,
  },
] as const;

export const DEFAULT_MODEL = AI_MODELS[0].value;

export const KDP = {
  width: 1600,
  height: 2560,
  aspectRatio: 1600 / 2560,
  dpi: 300,
  maxFileSize: 50 * 1024 * 1024,
  format: "jpeg" as const,
} as const;

export const MAX_IMAGES_PER_GENERATION = 8;

export const QUEUE_NAME = "cover-generation";

export const DEFAULT_BUCKET = "covergen";

export const DEFAULT_WS_URL = "ws://localhost:4000/ws/progress";

export const WS_RECONNECT_INITIAL_MS = 1000;
export const WS_RECONNECT_MAX_MS = 10000;

export const POLL_INTERVAL_MS = 5000;

export const IMAGE_COUNT_KEY_PREFIX = "imageCount";

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const PLAN_PRICES: Record<string, number> = {
  STARTER: 9,
  PRO: 19,
};

export const CREDIT_PACKS = [
  { id: "CREDITS_50", credits: 50, price: 5 },
  { id: "CREDITS_100", credits: 100, price: 9 },
  { id: "CREDITS_250", credits: 250, price: 20 },
] as const;

export type CreditPackId = typeof CREDIT_PACKS[number]["id"];

export const COLOR_PALETTES = [
  { value: "dark-moody", label: "Dark & Moody", colors: ["#0a0a0f", "#1a1a2e", "#2d1b3d", "#8b0000", "#d4d4d4"], description: "Deep shadows and high contrast with a blood-red accent. Thriller, horror, dark fantasy." },
  { value: "warm-inviting", label: "Warm & Inviting", colors: ["#8b4513", "#cd853f", "#daa520", "#ffd700", "#fff8dc"], description: "Soft golds, ambers, and cream. Romance, cozy fiction, warm-hearted stories." },
  { value: "cool-ethereal", label: "Cool & Ethereal", colors: ["#0d1b2a", "#1b2838", "#415a77", "#778da9", "#e0e1dd"], description: "Icy blues, slate, and silver. Sci-fi, mystery, literary fiction." },
  { value: "vibrant-bold", label: "Vibrant & Bold", colors: ["#e63946", "#f77f00", "#fcbf49", "#2a9d8f", "#264653"], description: "Saturated, eye-catching contrasts. Children's, YA, action-adventure." },
  { value: "earth-stone", label: "Earth & Stone", colors: ["#3d2b1f", "#5c4033", "#8b7355", "#b5a888", "#e8dcc8"], description: "Natural browns, tans, and warm grays. Literary fiction, historical, memoir." },
  { value: "pastel-soft", label: "Pastel Soft", colors: ["#ffd1dc", "#b5ead7", "#c7ceea", "#ffdac1", "#e2f0cb"], description: "Light, gentle pastels. Cozy mystery, light romance, feel-good fiction." },
  { value: "jewel-tones", label: "Jewel Tones", colors: ["#4a0e4e", "#0c2461", "#006266", "#8e1600", "#cc8e35"], description: "Rich, deep saturation. Epic fantasy, historical drama, opulent settings." },
  { value: "neon-electric", label: "Neon Electric", colors: ["#0d0221", "#0f084b", "#ff006e", "#00f5d4", "#ffbe0b"], description: "High-energy neon on dark backgrounds. Cyberpunk, tech thriller, urban sci-fi." },
  { value: "monochrome", label: "Monochrome", colors: ["#0a0a0a", "#333333", "#666666", "#999999", "#f5f5f5"], description: "Black-to-white grayscale. Minimalist, business, literary, typographic covers." },
  { value: "golden-luxe", label: "Golden Luxe", colors: ["#1a1a1a", "#8b6914", "#daa520", "#ffd700", "#f5f0e1"], description: "Premium golds against deep black. Business, self-help, luxury non-fiction." },
] as const;

export const EVENT_TYPE = {
  STATUS: "status",
  PROGRESS: "progress",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type EventType = typeof EVENT_TYPE[keyof typeof EVENT_TYPE];

export const WS_MESSAGE_TYPE = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
} as const;
