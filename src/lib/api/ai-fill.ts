import api from "./client";
import type { AiFillSuggestion } from "@/lib/ai-fill";
import type { AttributeConfigJson } from "@/lib/attributes";

interface GenerateAttributesResponse {
  suggestions: AiFillSuggestion[];
}

export async function generateAttributes(
  projectId: string,
  prompt: string
): Promise<AiFillSuggestion[]> {
  const { data } = await api.post<GenerateAttributesResponse>(
    "/api/attributes/generate",
    { projectId, prompt }
  );
  return data.suggestions;
}

interface EditAttributeConfigResponse {
  before: AttributeConfigJson;
  after: AttributeConfigJson;
}

export async function editAttributeConfig(
  prompt: string,
): Promise<EditAttributeConfigResponse> {
  const { data } = await api.post<EditAttributeConfigResponse>(
    "/api/attributes/edit",
    { prompt },
  );
  return data;
}
