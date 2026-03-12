import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stylePresetSchema } from "@/lib/attribute-validations";

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
    const preset = await prisma.stylePreset.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(preset);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch preset" },
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
    const parsed = stylePresetSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const preset = await prisma.stylePreset.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.attributes) {
      data.attributes = data.attributes as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue;
    }
    const updated = await prisma.stylePreset.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update preset" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const preset = await prisma.stylePreset.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!preset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.stylePreset.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    );
  }
}
