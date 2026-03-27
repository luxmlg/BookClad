import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiFillSchema } from "@/lib/validations";
import { reserveAiFillCredits, InsufficientCreditsError } from "@/lib/credits";
import { generateAttributeSuggestions } from "@/lib/ai-fill";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import { parseGeminiUsage, classifyError } from "@/lib/api-usage";
import { API_USAGE_TYPE } from "@/lib/constants";
import { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = aiFillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { projectId, prompt } = parsed.data;

  // Verify project belongs to user
  const project = await prisma.coverProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: { attributes: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch user's attribute config
  const configRecord = await prisma.attributeConfig.findUnique({
    where: { userId: session.user.id },
    select: { config: true },
  });

  if (!configRecord) {
    return NextResponse.json(
      { error: "Attribute config not found" },
      { status: 404 }
    );
  }

  // Reserve credits
  try {
    await reserveAiFillCredits(session.user.id);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: `Insufficient credits: need ${err.required}, have ${err.available}` },
        { status: 403 }
      );
    }
    throw err;
  }

  // Generate suggestions
  try {
    const config = configRecord.config as unknown as AttributeConfigJson;
    const selections = (project.attributes ?? {}) as unknown as AttributeSelection;

    const { suggestions, responseJson, durationMs } = await generateAttributeSuggestions(config, selections, prompt);

    // Log API usage (best-effort)
    try {
      const parsed = parseGeminiUsage(responseJson, "gemini-2.5-flash");
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_FILL,
          provider: "gemini",
          model: "gemini-2.5-flash",
          promptTokens: parsed.promptTokens,
          candidatesTokens: parsed.candidatesTokens,
          totalTokens: parsed.totalTokens,
          estimatedCostUsd: parsed.estimatedCostUsd,
          success: true,
          durationMs,
          responseMetadata: parsed.responseMetadata != null ? parsed.responseMetadata as unknown as Prisma.InputJsonValue : undefined,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Fill usage:", logErr);
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[ai-fill] Generation failed:", err);

    // Log failed API usage (best-effort)
    try {
      const errObj = err as Error & { status?: number; durationMs?: number; errorBody?: string };
      const errorType = classifyError(errObj.status ?? 0, errObj.message);
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_FILL,
          provider: "gemini",
          model: "gemini-2.5-flash",
          success: false,
          durationMs: errObj.durationMs ?? null,
          errorCode: errObj.status ? String(errObj.status) : null,
          errorType,
          errorMessage: errObj.message,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Fill error:", logErr);
    }

    const message =
      err instanceof Error ? err.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
