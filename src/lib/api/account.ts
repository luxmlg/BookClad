import api from "./client";

export async function deleteAccount(): Promise<void> {
  await api.delete("/api/account");
}
