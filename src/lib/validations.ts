import { z } from "zod";
import { GENRES, MOODS, ART_STYLES, AI_MODELS } from "./constants";

const genreValues = GENRES.map((g) => g.value) as [string, ...string[]];
const styleValues = ART_STYLES.map((s) => s.value) as [string, ...string[]];
const moodValues = [...MOODS] as [string, ...string[]];
const modelValues = AI_MODELS.map((m) => m.value) as [string, ...string[]];

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  author: z.string().min(1, "Author name is required").max(200),
  genre: z.enum(genreValues, { message: "Invalid genre" }),
  mood: z.array(z.enum(moodValues)).min(1, "Select at least one mood"),
  style: z.enum(styleValues, { message: "Invalid style" }),
  brief: z.string().max(2000).optional().nullable(),
});

export const createGenerationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  imageCount: z.number().int().min(1).max(8).optional().default(4),
  referenceImageId: z.string().optional(),
  model: z.enum(modelValues).optional().default("openai"),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  author: z.string().min(1).max(200).optional(),
  genre: z.enum(genreValues).optional(),
  mood: z.array(z.enum(moodValues)).min(1).optional(),
  style: z.enum(styleValues).optional(),
  brief: z.string().max(2000).optional().nullable(),
  canvasState: z.any().optional(),
});

export const updateImageSchema = z.object({
  selected: z.boolean(),
});

export const createInpaintSchema = z.object({
  imageId: z.string().min(1),
  maskDataUrl: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  model: z.enum(modelValues).optional().default("openai"),
});
