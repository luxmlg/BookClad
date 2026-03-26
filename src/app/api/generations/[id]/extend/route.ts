import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue } from "@/lib/queue";
import { extendGenerationSchema } from "@/lib/validations";
import { GENERATION_STATUS, MAX_IMAGES_PER_GENERATION, AI_MODELS, isModelAvailable, TIER_QUEUE_PRIORITY, JOB_TYPE } from "@/lib/constants";
import { calculateCreditCost, reserveExtensionCredits, InsufficientCreditsError } from "@/lib/credits";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: generationId } = await params;
    const body = await request.json();
    const parsed = extendGenerationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { imageCount } = parsed.data;

    const generation = await prisma.generation.findFirst({
      where: {
        id: generationId,
        project: { userId: session.user.id },
      },
      select: {
        id: true,
        status: true,
        model: true,
        projectId: true,
        referenceImage: true,
      },
    });

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    if (generation.status !== GENERATION_STATUS.COMPLETED) {
      return NextResponse.json(
        { error: "Only completed generations can be extended" },
        { status: 400 },
      );
    }

    const existingCount = await prisma.generatedImage.count({
      where: { generationId },
    });

    if (existingCount + imageCount > MAX_IMAGES_PER_GENERATION) {
      return NextResponse.json(
        {
          error: `Cannot exceed ${MAX_IMAGES_PER_GENERATION} images per generation. Currently has ${existingCount}, requested ${imageCount}.`,
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { tier: true },
    });

    const resolvedModel = generation.model ?? "quick";

    if (!isModelAvailable(resolvedModel, user.tier)) {
      const modelLabel = AI_MODELS.find((m) => m.value === resolvedModel)?.label ?? resolvedModel;
      return NextResponse.json(
        { error: `Upgrade to Starter to use the ${modelLabel} model` },
        { status: 403 },
      );
    }

    const creditCost = calculateCreditCost(resolvedModel, imageCount);

    await reserveExtensionCredits(
      session.user.id,
      generationId,
      creditCost,
      imageCount,
    );

    const priority = TIER_QUEUE_PRIORITY[user.tier] ?? 10;

    await getGenerationQueue().add(JOB_TYPE.GENERATE, {
      generationId,
      projectId: generation.projectId,
      userId: session.user.id,
      imageCount: existingCount + imageCount,
      model: resolvedModel,
      referenceImageKey: generation.referenceImage ?? null,
      flattenedImageDataUrl: null,
      creditCost,
      isExtension: true,
      extensionImageCount: imageCount,
    }, {
      priority,
      attempts: 100,
      backoff: { type: "custom" },
    });

    return NextResponse.json({ generationId }, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: err.message, required: err.required, available: err.available },
        { status: 403 },
      );
    }
    if (err instanceof Error && err.message === "Generation is not available for extension") {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to extend generation" },
      { status: 500 },
    );
  }
}
