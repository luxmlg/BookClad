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
