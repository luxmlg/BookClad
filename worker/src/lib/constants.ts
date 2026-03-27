export const KDP = {
  width: 1600,
  height: 2560,
  dpi: 300,
  aspectRatio: 1600 / 2560,
  jpegQuality: 92,
} as const;

export const QUEUE_NAME = "cover-generation";

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

export const MAX_IMAGES_PER_GENERATION = 8;

export const DEFAULT_BUCKET = "covergen";

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

export const REF_PROMPT_KEY = "ref-instructions";

export const RETRY_DELAYS = [10_000, 30_000, 60_000, 90_000, 120_000] as const;
export const MAX_OTHER_RETRIES = 5;
export const MAX_HIGH_DEMAND_RETRIES = 10;

export const CREDIT_COST_PER_IMAGE: Record<string, number> = {
  quick: 3,
  detailed: 5,
  premium: 10,
};

export const GEMINI_MODEL_IDS: Record<string, string> = {
  quick: "gemini-3.1-flash-image-preview",
  detailed: "gemini-3.1-flash-image-preview",
  premium: "gemini-3-pro-image-preview",
};

export interface GeminiModelConfig {
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: string;
}

export const GEMINI_MODEL_CONFIG: Record<string, GeminiModelConfig> = {
  quick: { aspectRatio: "9:16", imageSize: "1K" },
  detailed: { aspectRatio: "9:16", imageSize: "4K", thinkingLevel: "High" },
  premium: { aspectRatio: "9:16", imageSize: "4K" },
};

export const API_USAGE_TYPE = {
  GENERATION: "GENERATION",
  AI_FILL: "AI_FILL",
  AI_EDIT: "AI_EDIT",
} as const;
export type ApiUsageType = typeof API_USAGE_TYPE[keyof typeof API_USAGE_TYPE];

// Pricing from https://ai.google.dev/gemini-api/docs/pricing (March 2026)
// Image models: perImage uses the resolution tier matching our generation config
// Quick generates at 1K ($0.067), Detailed/Premium at 4K ($0.151/$0.24)
export const GEMINI_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number; perImage?: number }> = {
  "gemini-3.1-flash-image-preview": { inputPerMillion: 0.50, outputPerMillion: 60.00, perImage: 0.151 },
  "gemini-3-pro-image-preview": { inputPerMillion: 2.00, outputPerMillion: 120.00, perImage: 0.24 },
  "gemini-2.5-flash": { inputPerMillion: 0.30, outputPerMillion: 2.50 },
};
