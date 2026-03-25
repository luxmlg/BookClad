import type { AttributeSelection } from "@/lib/attributes";
import api from "./client";

interface TextLayerEntry {
  name: string;
  text: string;
  type: string;
  visible?: boolean;
}

export interface CreateGenerationParams {
  projectId: string;
  imageCount: number;
  model?: string;
  referenceImageId?: string;
  flattenedImageDataUrl?: string;
  attributeSnapshot?: AttributeSelection;
  textLayerSnapshot?: TextLayerEntry[];
}

export interface CreateInpaintParams {
  imageId: string;
  maskDataUrl: string;
  prompt: string;
  model?: string;
  flattenedImageDataUrl?: string;
  attributeSnapshot?: AttributeSelection;
  textLayerSnapshot?: TextLayerEntry[];
}

export interface CreateGenerationResponse {
  generationId: string;
}

export async function createGeneration(params: CreateGenerationParams): Promise<CreateGenerationResponse> {
  const { data } = await api.post<CreateGenerationResponse>("/api/generations", params);
  return data;
}

export async function getGeneration(id: string): Promise<{ status: string; errorMessage: string | null }> {
  const { data } = await api.get<{ status: string; errorMessage: string | null }>(`/api/generations/${id}`);
  return data;
}

export async function updateGenerationName(id: string, name: string): Promise<void> {
  await api.patch(`/api/generations/${id}`, { name });
}

export interface ExtendGenerationParams {
  imageCount: number;
}

export async function extendGeneration(
  generationId: string,
  params: ExtendGenerationParams,
): Promise<CreateGenerationResponse> {
  const { data } = await api.post<CreateGenerationResponse>(
    `/api/generations/${generationId}/extend`,
    params,
  );
  return data;
}

export async function createInpaint(params: CreateInpaintParams): Promise<CreateGenerationResponse> {
  const { data } = await api.post<CreateGenerationResponse>("/api/inpaint", params);
  return data;
}

export async function cancelGeneration(generationId: string): Promise<void> {
  await api.post(`/api/generations/${generationId}/cancel`);
}
