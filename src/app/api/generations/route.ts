import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue } from "@/lib/queue";
import { createGenerationSchema } from "@/lib/validations";
import { JOB_TYPE, GENERATION_STATUS } from "@/lib/constants";
import { calculateCreditCost, reserveCredits, InsufficientCreditsError } from "@/lib/credits";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createGenerationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      projectId,
      imageCount,
      referenceImageId,
      model,
      flattenedImageDataUrl,
      attributeSnapshot,
      textLayerSnapshot,
    } = parsed.data;

    const project = await prisma.coverProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let referenceImageKey: string | undefined;
    if (referenceImageId) {
      const refImage = await prisma.generatedImage.findFirst({
        where: {
          id: referenceImageId,
          generation: { project: { userId: session.user.id } },
        },
      });
      if (refImage) referenceImageKey = refImage.storageKey;
    }

    const jobType = referenceImageKey ? JOB_TYPE.GENERATE_FROM_REFERENCE : JOB_TYPE.GENERATE;
    const creditCost = calculateCreditCost(model, imageCount);

    const { generationId } = await reserveCredits(session.user.id, creditCost, {
      projectId: project.id,
      prompt: "",
      status: GENERATION_STATUS.QUEUED,
      imageCount,
      jobType,
      model,
      referenceImage: referenceImageKey ?? null,
      parentImageId: referenceImageId ?? null,
      includeLayers: !!flattenedImageDataUrl,
      attributeSnapshot: attributeSnapshot ?? undefined,
      textLayerSnapshot: textLayerSnapshot ?? undefined,
    });

    await getGenerationQueue().add(jobType, {
      generationId,
      projectId: project.id,
      userId: session.user.id,
      imageCount,
      model,
      referenceImageKey: referenceImageKey ?? null,
      flattenedImageDataUrl: flattenedImageDataUrl ?? null,
      creditCost,
    });

    return NextResponse.json({ generationId }, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: err.message, required: err.required, available: err.available },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create generation" },
      { status: 500 }
    );
  }
}
