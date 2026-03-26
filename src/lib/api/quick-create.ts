import api from "./client";

export interface QuickCreateParams {
  title: string;
  author: string;
  genre: string;
  description: string;
  imageCount?: number;
}

export interface QuickCreateResponse {
  projectId: string;
  generationId: string;
}

export async function quickCreate(
  params: QuickCreateParams,
): Promise<QuickCreateResponse> {
  const { data } = await api.post<QuickCreateResponse>(
    "/api/projects/quick-create",
    params,
  );
  return data;
}
