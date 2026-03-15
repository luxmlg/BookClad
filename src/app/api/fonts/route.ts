import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fonts = await prisma.userFont.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const results = await Promise.all(
      fonts.map(async (font) => {
        const url = await getSignedDownloadUrl(font.storageKey);

        return {
          id: font.id,
          family: font.family,
          fileName: font.fileName,
          fileSize: font.fileSize,
          mimeType: font.mimeType,
          disabled: font.disabled,
          createdAt: font.createdAt.toISOString(),
          url,
        };
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch fonts" },
      { status: 500 }
    );
  }
}
