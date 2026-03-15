import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FONT, FONTS } from "@/lib/fonts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { defaultFont: true, showPrompt: true },
  });

  return NextResponse.json({
    defaultFont: user?.defaultFont ?? DEFAULT_FONT,
    showPrompt: user?.showPrompt ?? false,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { defaultFont, showPrompt } = body;

  const data: Record<string, unknown> = {};

  if (defaultFont !== undefined) {
    if (typeof defaultFont !== "string" || !defaultFont.trim()) {
      return NextResponse.json({ error: "Invalid font name" }, { status: 400 });
    }

    const isGoogleFont = FONTS.some((f) => f.family === defaultFont);
    if (!isGoogleFont) {
      const customFont = await prisma.userFont.findFirst({
        where: { userId: session.user.id, family: defaultFont, disabled: false },
      });
      if (!customFont) {
        return NextResponse.json({ error: "Font not found" }, { status: 400 });
      }
    }
    data.defaultFont = defaultFont;
  }

  if (showPrompt !== undefined) {
    if (typeof showPrompt !== "boolean") {
      return NextResponse.json({ error: "Invalid showPrompt value" }, { status: 400 });
    }
    data.showPrompt = showPrompt;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { defaultFont: true, showPrompt: true },
  });

  return NextResponse.json({
    defaultFont: user.defaultFont,
    showPrompt: user.showPrompt,
  });
}
