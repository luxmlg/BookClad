import type { AttributeSelection } from "@/lib/attributes";
import api from "./client";

export interface CreateProjectParams {
  title: string;
  author: string;
  attributes: AttributeSelection;
}

export interface UpdateProjectParams {
  title?: string;
  author?: string;
  attributes?: AttributeSelection;
  canvasState?: unknown;
}

export interface ProjectAsset {
  id: string;
  url: string;
}

export interface UploadedAsset {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export async function createProject(params: CreateProjectParams): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>("/api/projects", params);
  return data;
}

export async function updateProject(id: string, params: UpdateProjectParams): Promise<void> {
  await api.patch(`/api/projects/${id}`, params);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

export async function getProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  const { data } = await api.get<ProjectAsset[]>(`/api/projects/${projectId}/assets`);
  return data;
}

export async function uploadAsset(file: File, projectId: string): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);
  form.append("projectId", projectId);
  const { data } = await api.post<UploadedAsset>("/api/assets/upload", form);
  return data;
}
