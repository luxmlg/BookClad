import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERATION_STATUS } from "@/lib/constants";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const project = await prisma.coverProject.findFirst({
      where: { id, userId: session.user.id },
      include: {
        generations: {
          where: { status: GENERATION_STATUS.COMPLETED },
          include: {
            images: { where: { selected: true }, take: 1 },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const selectedImage = project.generations[0]?.images[0];
    if (!selectedImage) {
      return NextResponse.json(
        { error: "No selected cover image. Please select a generated image first." },
        { status: 400 }
      );
    }

    const generationModel = project.generations[0]?.model;
    if (generationModel === "quick") {
      return NextResponse.json(
        { error: "Quick images are drafts and cannot be exported. Generate with Detailed or Premium for KDP-ready export." },
        { status: 400 },
      );
    }

    // TODO: Fetch image from R2, flatten canvas layers with Sharp, export as JPEG/PNG
    // For now, return the storage key so the client can download via signed URL
    return NextResponse.json({
      storageKey: selectedImage.storageKey,
      width: selectedImage.width,
      height: selectedImage.height,
      message: "Export endpoint ready. Full canvas flattening coming soon.",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to export" },
      { status: 500 }
    );
  }
}
