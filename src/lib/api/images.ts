import api from "./client";

export async function getImageUrl(id: string): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>(`/api/images/${id}`);
  return data;
}

export async function updateImage(id: string, body: { canvasState?: unknown; selected?: boolean }): Promise<void> {
  await api.patch(`/api/images/${id}`, body);
}
