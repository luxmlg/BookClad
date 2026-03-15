import { z } from "zod";

const attributeValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  builtIn: z.boolean(),
  visualRule: z.string().optional(),
});

const attributeCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  type: z.enum(["single", "multi", "text", "toggle", "scale", "color"]),
  builtIn: z.boolean(),
  enabled: z.boolean(),
  values: z.array(attributeValueSchema),
  scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
});

export const attributeConfigSchema = z.object({
  categories: z.array(attributeCategorySchema).min(1),
  briefPosition: z.number().int().min(0).optional(),
});

export const attributeSelectionSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
);

export const stylePresetSchema = z.object({
  name: z.string().min(1).max(100),
  attributes: attributeSelectionSchema,
  promptTemplate: z.string().max(5000).optional().nullable(),
});
