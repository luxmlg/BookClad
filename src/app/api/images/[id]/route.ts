import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";
import { updateImageSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const image = await prisma.generatedImage.findFirst({
      where: {
        id,
        generation: { project: { userId: session.user.id } },
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = await getSignedDownloadUrl(image.storageKey);
    return NextResponse.json({ url, image });
  } catch {
    return NextResponse.json(
      { error: "Failed to get image URL" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateImageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const image = await prisma.generatedImage.findFirst({
      where: {
        id,
        generation: { project: { userId: session.user.id } },
      },
      include: { generation: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (parsed.data.selected !== undefined) {
      if (parsed.data.selected) {
        await prisma.generatedImage.updateMany({
          where: { generationId: image.generationId },
          data: { selected: false },
        });
      }
      data.selected = parsed.data.selected;
    }

    if (parsed.data.canvasState !== undefined) {
      data.canvasState = parsed.data.canvasState;
    }

    const updated = await prisma.generatedImage.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}
