import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quickCreateSchema } from "@/lib/validations";
import {
  reserveAiFillCredits,
  reserveCredits,
  calculateCreditCost,
  InsufficientCreditsError,
} from "@/lib/credits";
import {
  generateAttributeSuggestions,
  applySuggestions,
} from "@/lib/ai-fill";
import {
  AI_FILL_CREDIT_COST,
  GENERATION_STATUS,
  JOB_TYPE,
  QUICK_CREATE_TIER_CONFIG,
} from "@/lib/constants";
import { getGenerationQueue } from "@/lib/queue";
import {
  buildDefaultConfig,
  ensureBuiltInAttributes,
  sanitizeConfig,
} from "@/lib/attributes";
import type { AttributeConfigJson, AttributeSelection } from "@/lib/attributes";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = quickCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { title, author, genre, description } = parsed.data;

    // Look up user tier
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { tier: true, creditBalance: true },
    });

    const tierConfig = QUICK_CREATE_TIER_CONFIG[user.tier];
    const { model } = tierConfig;
    const imageCount = parsed.data.imageCount ?? tierConfig.imageCount;
    const generationCreditCost = calculateCreditCost(model, imageCount);
    const totalCost = AI_FILL_CREDIT_COST + generationCreditCost;

    // Soft pre-flight check (not atomic) — gives the client a richer error.
    // The real guard is the atomic reserveAiFillCredits/reserveCredits calls below.
    if (user.creditBalance < totalCost) {
      return NextResponse.json(
        {
          error: `Insufficient credits: need ${totalCost}, have ${user.creditBalance}`,
          required: totalCost,
          available: user.creditBalance,
        },
        { status: 403 },
      );
    }

    // Reserve AI Fill credit
    await reserveAiFillCredits(session.user.id);

    // Fetch or create attribute config
    const configRecord = await prisma.attributeConfig.findUnique({
      where: { userId: session.user.id },
      select: { config: true },
    });

    let config: AttributeConfigJson;
    if (configRecord) {
      config = ensureBuiltInAttributes(
        configRecord.config as unknown as AttributeConfigJson,
      );
    } else {
      config = buildDefaultConfig();
      await prisma.attributeConfig.create({
        data: {
          userId: session.user.id,
          config: config as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Build seed selection with genre pre-set
    const seedSelection: AttributeSelection = { genre };

    // Generate attributes via AI Fill
    const { suggestions } = await generateAttributeSuggestions(
      config,
      seedSelection,
      description,
    );

    // Apply suggestions
    const { config: finalConfig, selection: finalSelection } = applySuggestions(
      config,
      seedSelection,
      suggestions,
    );

    // Sanitize and save updated config
    const sanitizedConfig = sanitizeConfig(finalConfig);
    await prisma.attributeConfig.update({
      where: { userId: session.user.id },
      data: { config: sanitizedConfig as unknown as Prisma.InputJsonValue },
    });

    // Create project
    const project = await prisma.coverProject.create({
      data: {
        userId: session.user.id,
        title,
        author,
        description,
        attributes: finalSelection as unknown as Prisma.InputJsonValue,
      },
    });

    // Reserve generation credits
    let generationId: string;
    try {
      const result = await reserveCredits(
        session.user.id,
        generationCreditCost,
        {
          projectId: project.id,
          prompt: "",
          status: GENERATION_STATUS.QUEUED,
          imageCount,
          jobType: JOB_TYPE.GENERATE,
          model,
          referenceImage: null,
          parentImageId: null,
          includeLayers: false,
          attributeSnapshot: finalSelection as unknown as Prisma.InputJsonValue,
        },
      );
      generationId = result.generationId;
    } catch (err) {
      // Clean up orphaned project
      await prisma.coverProject.delete({ where: { id: project.id } });
      throw err;
    }

    // Enqueue job
    await getGenerationQueue().add(JOB_TYPE.GENERATE, {
      generationId,
      projectId: project.id,
      userId: session.user.id,
      imageCount,
      model,
      referenceImageKey: null,
      flattenedImageDataUrl: null,
      creditCost: generationCreditCost,
    });

    return NextResponse.json(
      { projectId: project.id, generationId },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: err.message, required: err.required, available: err.available },
        { status: 403 },
      );
    }
    console.error("[quick-create] Failed:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
