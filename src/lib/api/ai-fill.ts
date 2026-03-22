import api from "./client";
import type { AiFillSuggestion } from "@/lib/ai-fill";

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
