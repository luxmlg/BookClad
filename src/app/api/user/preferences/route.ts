import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FONTS } from "@/lib/fonts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { defaultFont: true },
  });

  return NextResponse.json({ defaultFont: user?.defaultFont ?? "Playfair Display" });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { defaultFont } = body;

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: { defaultFont },
  });

  return NextResponse.json({ defaultFont });
}
