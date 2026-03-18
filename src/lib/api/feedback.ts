import type { FeedbackCategory, FeedbackArea, FeedbackContext } from "@/lib/feedback";
import api from "./client";

interface FeedbackSubmission {
  category: FeedbackCategory;
  title: string;
  description: string;
  area?: FeedbackArea;
  attachmentUrls: string[];
  context: FeedbackContext;
}

interface FeedbackResult {
  issueUrl: string;
  issueNumber: number;
}

export async function uploadFeedbackImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url: string }>("/api/feedback/upload", form);
  return data.url;
}

export async function submitFeedback(data: FeedbackSubmission): Promise<FeedbackResult> {
  const { data: result } = await api.post<FeedbackResult>("/api/feedback", data);
  return result;
}
