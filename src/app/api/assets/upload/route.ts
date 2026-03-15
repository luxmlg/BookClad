import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { useLocalStorage, uploadToStorage } from "@/lib/storage";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: file and projectId" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPEG, WebP, SVG" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    const project = await prisma.coverProject.findFirst({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = MIME_TO_EXT[file.type] ?? "bin";
    const fileId = crypto.randomUUID();
    const storageKey = `assets/${session.user.id}/${fileId}.${ext}`;

    await uploadToStorage(storageKey, buffer, file.type);

    const asset = await prisma.userAsset.create({
      data: {
        projectId,
        userId: session.user.id,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        width: null,
        height: null,
        fileSize: file.size,
      },
    });

    const url = useLocalStorage ? `/api/uploads/${storageKey}` : undefined;

    return NextResponse.json({
      id: asset.id,
      storageKey: asset.storageKey,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      url,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to upload asset" },
      { status: 500 }
    );
  }
}
