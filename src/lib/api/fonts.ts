import type { CustomFont } from "@/components/editor/types";
import api from "./client";

export interface FontDetail extends CustomFont {
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export async function listFonts(): Promise<FontDetail[]> {
  const { data } = await api.get<FontDetail[]>("/api/fonts");
  return data;
}

export async function uploadFont(file: File): Promise<FontDetail> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<FontDetail>("/api/fonts/upload", form);
  return data;
}

export async function renameFont(id: string, family: string): Promise<{ projectsUpdated: number }> {
  const { data } = await api.patch<{ projectsUpdated: number }>(`/api/fonts/${id}`, { family });
  return data;
}

export async function deleteFont(id: string): Promise<void> {
  await api.delete(`/api/fonts/${id}`);
}
