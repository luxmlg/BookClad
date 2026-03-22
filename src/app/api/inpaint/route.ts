import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue } from "@/lib/queue";
import { createInpaintSchema } from "@/lib/validations";
import { JOB_TYPE, GENERATION_STATUS } from "@/lib/constants";
import { calculateCreditCost, reserveCredits, InsufficientCreditsError } from "@/lib/credits";
import { uploadToStorage } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createInpaintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      imageId,
      maskDataUrl,
      prompt,
      model,
      flattenedImageDataUrl,
      attributeSnapshot,
      textLayerSnapshot,
    } = parsed.data;

    const image = await prisma.generatedImage.findFirst({
      where: {
        id: imageId,
        generation: { project: { userId: session.user.id } },
      },
      include: { generation: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const creditCost = calculateCreditCost(model, 1);

    const maskBuffer = Buffer.from(
      maskDataUrl.replace(/^data:image\/\w+;base64,/, ""),
      "base64",
    );
    const maskKey = `projects/${image.generation.projectId}/masks/${crypto.randomUUID()}.png`;
    await uploadToStorage(maskKey, maskBuffer, "image/png");

    const { generationId } = await reserveCredits(session.user.id, creditCost, {
      projectId: image.generation.projectId,
      prompt,
      status: GENERATION_STATUS.QUEUED,
      imageCount: 1,
      jobType: JOB_TYPE.INPAINT,
      model,
      referenceImage: image.storageKey,
      maskImage: maskKey,
      parentImageId: imageId,
      includeLayers: !!flattenedImageDataUrl,
      attributeSnapshot: attributeSnapshot ?? undefined,
      textLayerSnapshot: textLayerSnapshot ?? undefined,
    });

    await getGenerationQueue().add(JOB_TYPE.INPAINT, {
      generationId,
      projectId: image.generation.projectId,
      userId: session.user.id,
      sourceImageKey: image.storageKey,
      maskBase64: maskDataUrl,
      prompt,
      model,
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
    console.error("[inpaint] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create inpaint job" },
      { status: 500 }
    );
  }
}
