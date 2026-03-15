import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { downloadFromStorage, deleteFromStorage } from "@/lib/storage";

const MIME_MAP: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

const DEFAULT_FALLBACK_FONT = "Playfair Display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replaceFontInCanvasState(canvasState: any, oldFamily: string, newFamily: string): { updated: boolean; state: unknown } {
  if (!canvasState || !Array.isArray(canvasState.nodes)) {
    return { updated: false, state: canvasState };
  }
  let changed = false;
  const nodes = canvasState.nodes.map((node: Record<string, unknown>) => {
    if (node.type === "text" && node.fontFamily === oldFamily) {
      changed = true;
      return { ...node, fontFamily: newFamily };
    }
    return node;
  });
  return { updated: changed, state: changed ? { ...canvasState, nodes } : canvasState };
}

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

    const font = await prisma.userFont.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!font) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = font.storageKey.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_MAP[ext] ?? font.mimeType;

    const buffer = await downloadFromStorage(font.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const { family } = body as { family?: string };

    const font = await prisma.userFont.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!font) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let projectsUpdated = 0;

    // Handle rename
    if (typeof family === "string" && family.trim() && family.trim() !== font.family) {
      const newFamily = family.trim();

      // Check unique constraint
      const existing = await prisma.userFont.findFirst({
        where: { userId: session.user.id, family: newFamily, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A font with this name already exists" },
          { status: 409 }
        );
      }

      // Cascade rename through canvasState
      const oldFamily = font.family;

      const projects = await prisma.coverProject.findMany({
        where: { userId: session.user.id, canvasState: { not: Prisma.DbNull } },
        select: { id: true, canvasState: true },
      });

      const projectUpdates: { id: string; canvasState: unknown }[] = [];
      for (const p of projects) {
        const { updated, state } = replaceFontInCanvasState(p.canvasState, oldFamily, newFamily);
        if (updated) projectUpdates.push({ id: p.id, canvasState: state });
      }

      // Also update GeneratedImage canvasState
      const images: { id: string; canvasState: unknown }[] = await prisma.$queryRaw`
        SELECT gi.id, gi."canvasState"
        FROM "GeneratedImage" gi
        JOIN "Generation" g ON gi."generationId" = g.id
        JOIN "CoverProject" cp ON g."projectId" = cp.id
        WHERE cp."userId" = ${session.user.id}
        AND gi."canvasState" IS NOT NULL
      `;

      const imageUpdates: { id: string; canvasState: unknown }[] = [];
      for (const img of images) {
        const { updated, state } = replaceFontInCanvasState(img.canvasState, oldFamily, newFamily);
        if (updated) imageUpdates.push({ id: img.id, canvasState: state });
      }

      // Also update user's defaultFont if it matches
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { defaultFont: true },
      });

      await prisma.$transaction([
        ...projectUpdates.map((p) =>
          prisma.coverProject.update({ where: { id: p.id }, data: { canvasState: p.canvasState as object } })
        ),
        ...imageUpdates.map((img) =>
          prisma.generatedImage.update({ where: { id: img.id }, data: { canvasState: img.canvasState as object } })
        ),
        ...(user?.defaultFont === oldFamily
          ? [prisma.user.update({ where: { id: session.user.id }, data: { defaultFont: newFamily } })]
          : []),
      ]);

      projectsUpdated = projectUpdates.length + imageUpdates.length;
      updates.family = newFamily;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.userFont.update({ where: { id }, data: updates });
    }

    return NextResponse.json({ ok: true, projectsUpdated });
  } catch (error) {
    console.error("Font update failed:", error);
    return NextResponse.json(
      { error: "Failed to update font" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const font = await prisma.userFont.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!font) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Determine replacement font: user's default, or fallback if deleting the default
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultFont: true },
    });
    const isDefault = user?.defaultFont === font.family;
    const replacement = isDefault ? DEFAULT_FALLBACK_FONT : (user?.defaultFont ?? DEFAULT_FALLBACK_FONT);

    // Always cascade replacement through canvasState
    const projects = await prisma.coverProject.findMany({
      where: { userId: session.user.id, canvasState: { not: Prisma.DbNull } },
      select: { id: true, canvasState: true },
    });

    const projectUpdates: { id: string; canvasState: unknown }[] = [];
    for (const p of projects) {
      const { updated, state } = replaceFontInCanvasState(p.canvasState, font.family, replacement);
      if (updated) projectUpdates.push({ id: p.id, canvasState: state });
    }

    const images: { id: string; canvasState: unknown }[] = await prisma.$queryRaw`
      SELECT gi.id, gi."canvasState"
      FROM "GeneratedImage" gi
      JOIN "Generation" g ON gi."generationId" = g.id
      JOIN "CoverProject" cp ON g."projectId" = cp.id
      WHERE cp."userId" = ${session.user.id}
      AND gi."canvasState" IS NOT NULL
    `;

    const imageUpdates: { id: string; canvasState: unknown }[] = [];
    for (const img of images) {
      const { updated, state } = replaceFontInCanvasState(img.canvasState, font.family, replacement);
      if (updated) imageUpdates.push({ id: img.id, canvasState: state });
    }

    const txOps = [
      ...projectUpdates.map((p) =>
        prisma.coverProject.update({ where: { id: p.id }, data: { canvasState: p.canvasState as object } })
      ),
      ...imageUpdates.map((img) =>
        prisma.generatedImage.update({ where: { id: img.id }, data: { canvasState: img.canvasState as object } })
      ),
      ...(isDefault
        ? [prisma.user.update({ where: { id: session.user.id }, data: { defaultFont: DEFAULT_FALLBACK_FONT } })]
        : []),
    ];

    if (txOps.length > 0) {
      await prisma.$transaction(txOps);
    }

    await prisma.userFont.delete({ where: { id } });

    await deleteFromStorage(font.storageKey);

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete font" },
      { status: 500 }
    );
  }
}
