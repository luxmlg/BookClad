export interface GeneratedImage {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  selected: boolean;
  canvasState?: unknown;
}

import type { GenerationStatus } from "@/lib/constants";

export interface Generation {
  id: string;
  name?: string | null;
  status: GenerationStatus;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  model?: string;
  prompt?: string;
  userPrompt?: string | null;
  images: GeneratedImage[];
  parentImageId?: string | null;
  parentImage?: { id: string; storageKey: string } | null;
  includeLayers?: boolean;
  attributeSnapshot?: unknown;
  descriptionSnapshot?: unknown;
  textLayerSnapshot?: unknown;
}

export interface Project {
  id: string;
  title: string;
  author: string;
  attributes: unknown;
  canvasState: unknown;
  generations: Generation[];
}

export interface CustomFont {
  id: string;
  family: string;
  url: string;
}

export type AttributeSnapshot = Record<string, string | string[]>;

export interface DescriptionValueMeta {
  label: string;
  description?: string;
  colors?: string[];
}

export interface DescriptionAttrMeta {
  name: string;
  description?: string;
  values: Record<string, DescriptionValueMeta>;
}

export type DescriptionSnapshot = Record<string, DescriptionAttrMeta>;

export type TextLayerSnapshot = Array<{
  name: string;
  text: string;
  type: string;
  visible: boolean;
}>;

export function asAttributeSnapshot(val: unknown): AttributeSnapshot | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as AttributeSnapshot;
  }
  return null;
}

export function asDescriptionSnapshot(val: unknown): DescriptionSnapshot | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as DescriptionSnapshot;
  }
  return null;
}

export function asTextLayerSnapshot(val: unknown): TextLayerSnapshot | null {
  if (Array.isArray(val)) return val as TextLayerSnapshot;
  return null;
}

export const PANEL_MAX_HEIGHT = 320;
