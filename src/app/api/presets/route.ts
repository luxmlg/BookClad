import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stylePresetSchema } from "@/lib/attribute-validations";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const presets = await prisma.stylePreset.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(presets);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = stylePresetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const preset = await prisma.stylePreset.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        attributes: parsed.data.attributes as unknown as Prisma.InputJsonValue,
        promptTemplate: parsed.data.promptTemplate ?? null,
      },
    });

    return NextResponse.json(preset, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create preset" },
      { status: 500 }
    );
  }
}
