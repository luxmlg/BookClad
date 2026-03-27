import { Sparkles, Copy } from "lucide-react";
import { AI_MODELS, JOB_TYPE } from "@/lib/constants";
import type { Generation } from "./types";

export const JOB_TYPE_ICON: Record<string, typeof Sparkles> = {
  [JOB_TYPE.GENERATE]: Sparkles,
  [JOB_TYPE.GENERATE_FROM_REFERENCE]: Copy,
};

export function getModelLabel(modelValue?: string): string | null {
  if (!modelValue) return null;
  const found = AI_MODELS.find((m) => m.value === modelValue);
  return found ? found.label : modelValue;
}

export function findParentGenerationIndex(
  parentImageId: string | null | undefined,
  allGenerations: Generation[],
): number | null {
  if (!parentImageId) return null;
  for (let i = 0; i < allGenerations.length; i++) {
    if (allGenerations[i].images.some((img) => img.id === parentImageId)) {
      return allGenerations.length - i;
    }
  }
  return null;
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
