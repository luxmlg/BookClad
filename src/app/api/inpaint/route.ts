import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Queue } from "bullmq";
import { createInpaintSchema } from "@/lib/validations";

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
    const parsed = createInpaintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { imageId, maskDataUrl, prompt, model } = parsed.data;

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

    const generation = await prisma.generation.create({
      data: {
        projectId: image.generation.projectId,
        prompt,
        status: "QUEUED",
        imageCount: 1,
        jobType: "inpaint",
        model,
        referenceImage: image.storageKey,
      },
    });

    await generationQueue.add("inpaint", {
      generationId: generation.id,
      projectId: image.generation.projectId,
      userId: session.user.id,
      sourceImageKey: image.storageKey,
      maskBase64: maskDataUrl,
      prompt,
      model,
    });

    return NextResponse.json({ generationId: generation.id }, { status: 202 });
  } catch (err) {
    console.error("[inpaint] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create inpaint job" },
      { status: 500 }
    );
  }
}
