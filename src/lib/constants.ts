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
  RETRYING: "RETRYING",
} as const;
export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS];

export const JOB_TYPE = {
  GENERATE: "generate",
  GENERATE_FROM_REFERENCE: "generate-from-reference",
} as const;
export type JobType = typeof JOB_TYPE[keyof typeof JOB_TYPE];

export const CREDIT_COST_PER_IMAGE: Record<string, number> = {
  quick: 3,
  detailed: 5,
  premium: 10,
};

export const AI_FILL_CREDIT_COST = 1;
export const AI_FILL_PROMPT_MAX_LENGTH = 1000;

export const TIER_CREDITS: Record<string, number> = {
  FREE: 15,
  STARTER: 100,
  PRO: 250,
  STUDIO: 500,
};

export const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  STUDIO: 3,
};

export const TIER_QUEUE_PRIORITY: Record<string, number> = {
  FREE: 10,
  STARTER: 10,
  PRO: 1,
  STUDIO: 1,
};

export const QUICK_CREATE_TIER_CONFIG = {
  FREE: { model: "quick", imageCount: 4 },
  STARTER: { model: "detailed", imageCount: 8 },
  PRO: { model: "detailed", imageCount: 8 },
  STUDIO: { model: "detailed", imageCount: 8 },
} as const;

export const AI_MODELS = [
  {
    value: "quick",
    label: "Quick",
    description:
      "Low-cost drafts for exploring ideas and styles. Not export-ready — upgrade to Detailed or Premium for KDP-ready covers.",
    capabilities: [JOB_TYPE.GENERATE] as const,
    creditCost: CREDIT_COST_PER_IMAGE.quick,
    requiredTier: "FREE",
    exportable: false,
  },
  {
    value: "detailed",
    label: "Detailed",
    description:
      "Recommended for most covers. High-efficiency generation with improved consistency and detail — the best balance of speed, quality, and cost.",
    capabilities: [JOB_TYPE.GENERATE] as const,
    creditCost: CREDIT_COST_PER_IMAGE.detailed,
    requiredTier: "STARTER",
    exportable: true,
  },
  {
    value: "premium",
    label: "Premium",
    description:
      "Professional-grade cover generation with advanced reasoning. Excels at following complex instructions and rendering high-fidelity text and intricate details.",
    capabilities: [JOB_TYPE.GENERATE] as const,
    creditCost: CREDIT_COST_PER_IMAGE.premium,
    requiredTier: "STARTER",
    exportable: true,
  },
] as const;

export function isModelAvailable(modelValue: string, userTier: string): boolean {
  const model = AI_MODELS.find((m) => m.value === modelValue);
  if (!model) return false;
  return (TIER_ORDER[userTier] ?? 0) >= (TIER_ORDER[model.requiredTier] ?? 0);
}

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


export const RETRY_DELAYS = [10_000, 30_000, 60_000, 90_000, 120_000] as const;
export const MAX_OTHER_RETRIES = 5;
export const MAX_HIGH_DEMAND_RETRIES = 10;

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
  STUDIO: 35,
};

export const CREDIT_PACKS = [
  { id: "CREDITS_50", credits: 50, price: 5 },
  { id: "CREDITS_100", credits: 100, price: 9 },
  { id: "CREDITS_250", credits: 250, price: 20 },
  { id: "CREDITS_500", credits: 500, price: 35 },
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
  RETRYING: "retrying",
} as const;
export type EventType = typeof EVENT_TYPE[keyof typeof EVENT_TYPE];

export const WS_MESSAGE_TYPE = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  SUBSCRIBE_PROJECT: "subscribe_project",
  UNSUBSCRIBE_PROJECT: "unsubscribe_project",
} as const;

export const API_USAGE_TYPE = {
  GENERATION: "GENERATION",
  AI_FILL: "AI_FILL",
  AI_EDIT: "AI_EDIT",
} as const;
export type ApiUsageType = typeof API_USAGE_TYPE[keyof typeof API_USAGE_TYPE];

export const GEMINI_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number; perImage?: number }> = {
  "gemini-3.1-flash-image-preview": { inputPerMillion: 0.10, outputPerMillion: 0.40, perImage: 0.02 },
  "gemini-3-pro-image-preview": { inputPerMillion: 1.25, outputPerMillion: 5.00, perImage: 0.07 },
  "gemini-2.5-flash": { inputPerMillion: 0.15, outputPerMillion: 0.60 },
};
