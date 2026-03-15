export interface GeneratedImage {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  selected: boolean;
  canvasState?: unknown;
}

export interface Generation {
  id: string;
  name?: string | null;
  status: string;
  createdAt: string | Date;
  imageCount?: number;
  jobType?: string;
  model?: string;
  prompt?: string;
  images: GeneratedImage[];
  parentImageId?: string | null;
  parentImage?: { id: string; storageKey: string } | null;
  attributeSnapshot?: unknown;
  textLayerSnapshot?: unknown;
}

export interface Project {
  id: string;
  title: string;
  author: string;
  attributes: unknown;
  brief: string | null;
  canvasState: unknown;
  generations: Generation[];
}

export interface CustomFont {
  id: string;
  family: string;
  url: string;
}

export type AttributeSnapshot = Record<string, string | string[]>;
export type TextLayerSnapshot = Array<{ name: string; text: string }>;

export function asAttributeSnapshot(val: unknown): AttributeSnapshot | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as AttributeSnapshot;
  }
  return null;
}

export function asTextLayerSnapshot(val: unknown): TextLayerSnapshot | null {
  if (Array.isArray(val)) return val as TextLayerSnapshot;
  return null;
}

export const PANEL_MAX_HEIGHT = 320;
