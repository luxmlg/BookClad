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
