export const FEEDBACK_CATEGORIES = ["bug", "feature", "general"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_AREAS = [
  "editor",
  "generation",
  "billing",
  "account",
  "other",
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General Feedback",
};

export const CATEGORY_PREFIXES: Record<FeedbackCategory, string> = {
  bug: "[Bug]",
  feature: "[Feature]",
  general: "[Feedback]",
};

export const CATEGORY_PLACEHOLDERS: Record<FeedbackCategory, string> = {
  bug: "What happened? What did you expect to happen instead?",
  feature: "Describe the feature you'd like to see and how it would help you.",
  general: "Share your thoughts, suggestions, or anything else on your mind.",
};

export const AREA_LABELS: Record<FeedbackArea, string> = {
  editor: "Editor",
  generation: "Generation",
  billing: "Billing",
  account: "Account",
  other: "Other",
};

export const GITHUB_LABEL_TYPE: Record<FeedbackCategory, string> = {
  bug: "type:bug",
  feature: "type:feature",
  general: "type:general",
};

export const GITHUB_LABEL_AREA: Record<FeedbackArea, string> = {
  editor: "area:editor",
  generation: "area:generation",
  billing: "area:billing",
  account: "area:account",
  other: "area:other",
};

export const GITHUB_LABEL_SOURCE = "source:in-app";

export interface FeedbackContext {
  url: string;
  projectId?: string;
  userAgent: string;
  screenResolution: string;
}

export function captureFeedbackContext(): FeedbackContext {
  const pathname = window.location.pathname;
  const editorMatch = pathname.match(/^\/editor\/([^/]+)/);

  return {
    url: pathname,
    projectId: editorMatch?.[1],
    userAgent: navigator.userAgent,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
  };
}

interface IssueBodyParams {
  description: string;
  attachmentUrls: string[];
  area?: FeedbackArea;
  userName?: string | null;
  userEmail?: string | null;
  userId: string;
  tier: string;
  context: FeedbackContext;
}

export function formatIssueBody(params: IssueBodyParams): string {
  const {
    description,
    attachmentUrls,
    area,
    userName,
    userEmail,
    userId,
    tier,
    context,
  } = params;

  const attachments =
    attachmentUrls.length > 0
      ? attachmentUrls.map((url, i) => `![Attachment ${i + 1}](${url})`).join("\n")
      : "No attachments";

  const areaLabel = area ? AREA_LABELS[area] : "Not specified";

  return `## Description
${description}

## Attachments
${attachments}

## Related Area
${areaLabel}

---

<details>
<summary>Context (auto-captured)</summary>

| Field | Value |
|-------|-------|
| User | ${userName ?? "Unknown"} (${userEmail ?? "Unknown"}) |
| User ID | ${userId} |
| Tier | ${tier} |
| Page | ${context.url} |
| Project | ${context.projectId ?? "N/A"} |
| Browser | ${context.userAgent} |
| Screen | ${context.screenResolution} |
| Submitted | ${new Date().toISOString()} |

</details>`;
}
