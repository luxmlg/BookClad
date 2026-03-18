import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedbackSchema } from "@/lib/validations";
import {
  CATEGORY_PREFIXES,
  GITHUB_LABEL_TYPE,
  GITHUB_LABEL_AREA,
  GITHUB_LABEL_SOURCE,
  formatIssueBody,
} from "@/lib/feedback";
import type { FeedbackCategory, FeedbackArea } from "@/lib/feedback";

const LABEL_COLORS: Record<string, string> = {
  "type:bug": "d73a4a",
  "type:feature": "0075ca",
  "type:general": "999999",
  "area:editor": "2da44e",
  "area:generation": "3fb950",
  "area:billing": "56d364",
  "area:account": "7ee787",
  "area:other": "a5d6a7",
  "source:in-app": "7c3aed",
};

function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

function parseRepo(): { owner: string; repo: string } | null {
  const repoStr = process.env.GITHUB_FEEDBACK_REPO;
  if (!repoStr) return null;
  const [owner, repo] = repoStr.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}

async function ensureLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  name: string
): Promise<void> {
  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: LABEL_COLORS[name] ?? "ededed",
    });
  } catch (error: unknown) {
    // Label already exists — ignore 422 (validation failed = already exists)
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status: number }).status === 422
    ) {
      return;
    }
    throw error;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const octokit = getOctokit();
  const repoInfo = parseRepo();
  if (!octokit || !repoInfo) {
    return NextResponse.json(
      { error: "Feedback system not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { category, title, description, area, attachmentUrls, context } =
    parsed.data;

  try {
    // Get user tier for context
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });

    const { owner, repo } = repoInfo;

    // Build labels
    const labels = [
      GITHUB_LABEL_TYPE[category as FeedbackCategory],
      GITHUB_LABEL_SOURCE,
    ];
    if (area) {
      labels.push(GITHUB_LABEL_AREA[area as FeedbackArea]);
    }

    // Ensure all labels exist
    await Promise.all(
      labels.map((label) => ensureLabel(octokit, owner, repo, label))
    );

    // Create issue
    const issueTitle = `${CATEGORY_PREFIXES[category as FeedbackCategory]} ${title}`;
    const issueBody = formatIssueBody({
      description,
      attachmentUrls,
      area: area as FeedbackArea | undefined,
      userName: session.user.name,
      userEmail: session.user.email,
      userId: session.user.id,
      tier: user?.tier ?? "FREE",
      context,
    });

    const { data: issue } = await octokit.rest.issues.create({
      owner,
      repo,
      title: issueTitle,
      body: issueBody,
      labels,
    });

    return NextResponse.json({
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback. Please try again later." },
      { status: 502 }
    );
  }
}
