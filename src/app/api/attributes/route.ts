import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDefaultConfig, ensureBuiltInCategories, type AttributeConfigJson } from "@/lib/attributes";
import { attributeConfigSchema } from "@/lib/attribute-validations";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let record = await prisma.attributeConfig.findUnique({
      where: { userId: session.user.id },
    });

    if (!record) {
      const config = buildDefaultConfig();
      record = await prisma.attributeConfig.create({
        data: { userId: session.user.id, config: config as unknown as Prisma.InputJsonValue },
      });
    }

    const config = ensureBuiltInCategories(record.config as AttributeConfigJson);
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch attribute config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = attributeConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const record = await prisma.attributeConfig.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, config: parsed.data as unknown as Prisma.InputJsonValue },
      update: { config: parsed.data as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json(record.config);
  } catch {
    return NextResponse.json(
      { error: "Failed to update attribute config" },
      { status: 500 }
    );
  }
}
