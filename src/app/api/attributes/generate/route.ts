import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiFillSchema } from "@/lib/validations";
import { reserveAiFillCredits, InsufficientCreditsError } from "@/lib/credits";
import { generateAttributeSuggestions } from "@/lib/ai-fill";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";

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

    const suggestions = await generateAttributeSuggestions(config, selections, prompt);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[ai-fill] Generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
