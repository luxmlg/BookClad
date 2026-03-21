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
} as const;
export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS];

export const JOB_TYPE = {
  GENERATE: "generate",
  INPAINT: "inpaint",
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
} as const;
export type EventType = typeof EVENT_TYPE[keyof typeof EVENT_TYPE];

export const WS_MESSAGE_TYPE = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
} as const;

export const REF_PROMPT_KEY = "ref-instructions";

export const CREDIT_COST_PER_IMAGE: Record<string, number> = {
  quick: 2,
  detailed: 3,
  premium: 5,
};

export const GEMINI_MODEL_IDS: Record<string, string> = {
  quick: "gemini-2.5-flash-image",
  detailed: "gemini-3.1-flash-image-preview",
  premium: "gemini-3-pro-image-preview",
};

export interface GeminiModelConfig {
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: string;
}

export const GEMINI_MODEL_CONFIG: Record<string, GeminiModelConfig> = {
  quick: {},
  detailed: { aspectRatio: "9:16", imageSize: "4K", thinkingLevel: "High" },
  premium: { aspectRatio: "9:16", imageSize: "4K" },
};
