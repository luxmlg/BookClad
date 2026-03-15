import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import api from "./client";

export interface Preset {
  id: string;
  name: string;
  attributes: AttributeSelection;
  promptTemplate: string | null;
}

export interface UserPreferences {
  defaultFont?: string;
  showPrompt?: boolean;
}

export async function getAttributeConfig(): Promise<AttributeConfigJson> {
  const { data } = await api.get<AttributeConfigJson>("/api/attributes");
  return data;
}

export async function saveAttributeConfig(config: AttributeConfigJson): Promise<void> {
  await api.put("/api/attributes", config);
}

export async function getPresets(): Promise<Preset[]> {
  const { data } = await api.get<Preset[]>("/api/presets");
  return data;
}

export async function createPreset(name: string, attributes: AttributeSelection): Promise<Preset> {
  const { data } = await api.post<Preset>("/api/presets", { name, attributes });
  return data;
}

export async function deletePreset(id: string): Promise<void> {
  await api.delete(`/api/presets/${id}`);
}

export async function getPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<UserPreferences>("/api/user/preferences");
  return data;
}

export async function updatePreferences(prefs: UserPreferences): Promise<void> {
  await api.patch("/api/user/preferences", prefs);
}
