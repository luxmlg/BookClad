import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Queue } from "bullmq";
import { createGenerationSchema } from "@/lib/validations";

const generationQueue = new Queue("cover-generation", {
  connection: {
    host: new URL(process.env.REDIS_URL ?? "redis://localhost:6379").hostname,
    port: parseInt(
      new URL(process.env.REDIS_URL ?? "redis://localhost:6379").port || "6379"
    ),
  },
});

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (user?.tier === "FREE" && (user.generationsUsed ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Free tier limit reached (3 generations/month)" },
        { status: 403 }
      );
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

    const jobType = referenceImageKey ? "generate-from-reference" : "generate";

    const generation = await prisma.generation.create({
      data: {
        projectId: project.id,
        prompt: "",
        status: "QUEUED",
        imageCount,
        jobType,
        model,
        referenceImage: referenceImageKey ?? null,
        parentImageId: referenceImageId ?? null,
        attributeSnapshot: attributeSnapshot ?? undefined,
        textLayerSnapshot: textLayerSnapshot ?? undefined,
      },
    });

    await generationQueue.add(jobType, {
      generationId: generation.id,
      projectId: project.id,
      userId: session.user.id,
      imageCount,
      model,
      referenceImageKey: referenceImageKey ?? null,
      flattenedImageDataUrl: flattenedImageDataUrl ?? null,
    });

    return NextResponse.json({ generationId: generation.id }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create generation" },
      { status: 500 }
    );
  }
}
