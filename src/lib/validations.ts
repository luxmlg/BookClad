import { z } from "zod";
import { AI_MODELS, MAX_IMAGES_PER_GENERATION } from "./constants";

const modelValues = AI_MODELS.map((m) => m.value) as [string, ...string[]];

const attributeSelectionField = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
);

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  author: z.string().min(1, "Author name is required").max(200),
  attributes: attributeSelectionField,
});

const snapshotFields = {
  attributeSnapshot: attributeSelectionField.optional(),
  textLayerSnapshot: z
    .array(z.object({
      name: z.string(),
      text: z.string(),
      type: z.string().optional(),
      visible: z.boolean().optional(),
    }))
    .optional(),
};

export const createGenerationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  imageCount: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION).optional().default(4),
  referenceImageId: z.string().optional(),
  model: z.enum(modelValues).optional().default("quick"),
  flattenedImageDataUrl: z.string().optional(),
  ...snapshotFields,
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  author: z.string().min(1).max(200).optional(),
  attributes: attributeSelectionField.optional(),
  canvasState: z.any().optional(),
});

export const updateImageSchema = z.object({
  selected: z.boolean().optional(),
  canvasState: z.any().optional(),
});

export const updateGenerationSchema = z.object({
  name: z.string().max(100),
});

export const feedbackSchema = z.object({
  category: z.enum(["bug", "feature", "general"]),
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  area: z.enum(["editor", "generation", "billing", "account", "other"]).optional(),
  attachmentUrls: z.array(z.string().url()).max(3).default([]),
  context: z.object({
    url: z.string(),
    projectId: z.string().optional(),
    userAgent: z.string(),
    screenResolution: z.string(),
  }),
});

export const extendGenerationSchema = z.object({
  imageCount: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION),
});

export const createInpaintSchema = z.object({
  imageId: z.string().min(1),
  maskDataUrl: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  model: z.enum(modelValues).optional().default("quick"),
  flattenedImageDataUrl: z.string().optional(),
  ...snapshotFields,
});
