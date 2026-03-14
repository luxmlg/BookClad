import { z } from "zod";
import { AI_MODELS } from "./constants";

const modelValues = AI_MODELS.map((m) => m.value) as [string, ...string[]];

const attributeSelectionField = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
);

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  author: z.string().min(1, "Author name is required").max(200),
  attributes: attributeSelectionField,
  brief: z.string().max(2000).optional().nullable(),
});

const snapshotFields = {
  attributeSnapshot: attributeSelectionField.optional(),
  textLayerSnapshot: z
    .array(z.object({ name: z.string(), text: z.string() }))
    .optional(),
};

export const createGenerationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  imageCount: z.number().int().min(1).max(8).optional().default(4),
  referenceImageId: z.string().optional(),
  model: z.enum(modelValues).optional().default("openai"),
  flattenedImageDataUrl: z.string().optional(),
  ...snapshotFields,
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  author: z.string().min(1).max(200).optional(),
  attributes: attributeSelectionField.optional(),
  brief: z.string().max(2000).optional().nullable(),
  canvasState: z.any().optional(),
});

export const updateImageSchema = z.object({
  selected: z.boolean().optional(),
  canvasState: z.any().optional(),
});

export const updateGenerationSchema = z.object({
  name: z.string().max(100),
});

export const createInpaintSchema = z.object({
  imageId: z.string().min(1),
  maskDataUrl: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  model: z.enum(modelValues).optional().default("openai"),
  flattenedImageDataUrl: z.string().optional(),
  ...snapshotFields,
});
