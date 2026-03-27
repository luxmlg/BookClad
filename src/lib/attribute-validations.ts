import { z } from "zod";

const attributeValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  builtIn: z.boolean(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  colors: z.array(z.string()).optional(),
});

const attributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  type: z.enum(["single", "multi", "text", "toggle", "scale", "color", "palette"]),
  builtIn: z.boolean(),
  enabled: z.boolean(),
  description: z.string().max(200).optional(),
  values: z.array(attributeValueSchema),
  scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
});

export const attributeConfigSchema = z.object({
  attributes: z.array(attributeSchema).min(1),
  briefPosition: z.number().int().min(0).optional(),
}).superRefine((config, ctx) => {
  const seenIds = new Set<string>();
  for (let i = 0; i < config.attributes.length; i++) {
    const id = config.attributes[i].id;
    if (seenIds.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate attribute ID "${id}"`,
        path: ["attributes", i, "id"],
      });
    }
    seenIds.add(id);

    const seenValues = new Set<string>();
    for (let j = 0; j < config.attributes[i].values.length; j++) {
      const val = config.attributes[i].values[j].value;
      if (seenValues.has(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate value "${val}" in attribute "${id}"`,
          path: ["attributes", i, "values", j, "value"],
        });
      }
      seenValues.add(val);
    }
  }
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
