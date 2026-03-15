import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl, deleteFromStorage } from "@/lib/storage";

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

    const asset = await prisma.userAsset.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = await getSignedDownloadUrl(asset.storageKey);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "Failed to get asset URL" },
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

    const asset = await prisma.userAsset.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteFromStorage(asset.storageKey);

    await prisma.userAsset.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
