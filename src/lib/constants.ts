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

export const GENRE_VISUAL_RULES: Record<string, string> = {
  thriller:
    "High contrast, desaturated palette, single dominant silhouette or object, dramatic shadow",
  romance:
    "Warm/rose tones, soft focus, figures (if any) in close proximity, bokeh background",
  "epic-fantasy":
    "Wide establishing shot, sense of scale, glowing magical elements, deep sky",
  "urban-fantasy":
    "City skyline with magical elements, neon or twilight palette, single figure in foreground",
  "cozy-fantasy":
    "Warm interior or cottage scene, soft lighting, magical whimsy, comfortable palette",
  "sci-fi":
    "Futuristic setting, cool blue/teal palette, technology or space elements, dramatic lighting",
  horror:
    "Low key lighting, desaturated with single accent color (red/sickly green), isolation/dread",
  "cozy-mystery":
    "Illustrated style, warm colors, small-town or domestic setting, cat/teacup motif",
  "self-help":
    "Clean geometric layout, bold typography-friendly negative space, professional palette",
  business:
    "Sleek modern aesthetic, confident palette, abstract geometric shapes or city imagery",
  childrens:
    "Bright vivid colors, playful illustrated style, friendly characters, whimsical elements",
  "literary-fiction":
    "Understated, moody, artistic composition with symbolic imagery and muted tones",
};

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

export const AI_MODELS = [
  {
    value: "openai",
    label: "OpenAI (gpt-image-1)",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
  },
  {
    value: "gemini",
    label: "Gemini 2.0 Flash",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
  },
  {
    value: "ideogram",
    label: "Ideogram V3",
    capabilities: [JOB_TYPE.GENERATE, JOB_TYPE.INPAINT] as const,
  },
] as const;

export const KDP = {
  width: 1600,
  height: 2560,
  aspectRatio: 1600 / 2560,
  dpi: 300,
  maxFileSize: 50 * 1024 * 1024,
  format: "jpeg" as const,
} as const;

export const QUEUE_NAME = "cover-generation";

export const DEFAULT_BUCKET = "covergen";

export const DEFAULT_WS_URL = "ws://localhost:4000/ws/progress";

export const WS_RECONNECT_INITIAL_MS = 1000;
export const WS_RECONNECT_MAX_MS = 10000;

export const POLL_INTERVAL_MS = 5000;

export const IMAGE_COUNT_KEY_PREFIX = "imageCount";

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
