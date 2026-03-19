import api from "./client";

export interface DeleteImagesResponse {
  deleted: string[];
  generationsRemoved: string[];
}

export async function getImageUrl(id: string): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>(`/api/images/${id}`);
  return data;
}

export async function updateImage(id: string, body: { canvasState?: unknown; selected?: boolean }): Promise<void> {
  await api.patch(`/api/images/${id}`, body);
}

export async function deleteImages(imageIds: string[]): Promise<DeleteImagesResponse> {
  const { data } = await api.delete<DeleteImagesResponse>("/api/images/batch", { data: { imageIds } });
  return data;
}
