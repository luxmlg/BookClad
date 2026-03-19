import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";
import { deleteImagesSchema } from "@/lib/validations";

interface DeleteImagesResponse {
  deleted: string[];
  generationsRemoved: string[];
}

export async function DELETE(request: Request): Promise<NextResponse<DeleteImagesResponse | { error: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = deleteImagesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed" },
        { status: 400 },
      );
    }

    const { imageIds } = parsed.data;

    // Load all requested images with ownership check
    const images = await prisma.generatedImage.findMany({
      where: {
        id: { in: imageIds },
        generation: { project: { userId: session.user.id } },
      },
      include: { generation: { select: { id: true, imageCount: true, _count: { select: { images: true } } } } },
    });

    if (images.length === 0) {
      return NextResponse.json({ error: "No images found" }, { status: 404 });
    }

    const deleted: string[] = [];
    const generationsRemoved: string[] = [];
    const storageKeys: string[] = [];

    // Group images by generation
    const byGeneration = new Map<string, typeof images>();
    for (const img of images) {
      const group = byGeneration.get(img.generationId) ?? [];
      group.push(img);
      byGeneration.set(img.generationId, group);
    }

    for (const [generationId, genImages] of byGeneration) {
      const gen = genImages[0].generation;
      const totalImagesInGen = gen._count.images;
      const deletingAll = genImages.length >= totalImagesInGen;

      if (deletingAll) {
        // Delete entire generation (cascade deletes images)
        await prisma.generation.delete({ where: { id: generationId } });
        generationsRemoved.push(generationId);
      } else {
        // Delete specific images and decrement imageCount
        const ids = genImages.map((img) => img.id);
        await prisma.$transaction([
          prisma.generatedImage.deleteMany({ where: { id: { in: ids } } }),
          prisma.generation.update({
            where: { id: generationId },
            data: { imageCount: { decrement: genImages.length } },
          }),
        ]);
      }

      for (const img of genImages) {
        deleted.push(img.id);
        storageKeys.push(img.storageKey);
      }
    }

    // Background storage cleanup
    Promise.all(storageKeys.map((key) => deleteFromStorage(key))).catch(() => {});

    return NextResponse.json({ deleted, generationsRemoved });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete images" },
      { status: 500 },
    );
  }
}
