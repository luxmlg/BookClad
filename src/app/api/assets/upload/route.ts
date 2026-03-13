import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const useLocalStorage = !process.env.R2_ENDPOINT;

const s3 = useLocalStorage
  ? null
  : new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials:
        process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.R2_ACCESS_KEY_ID,
              secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            }
          : undefined,
    });

const bucket = process.env.R2_BUCKET ?? "covergen";

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

    if (useLocalStorage || !s3) {
      const filePath = join(process.cwd(), "uploads", storageKey);
      await mkdir(join(process.cwd(), "uploads", "assets", session.user.id), {
        recursive: true,
      });
      await writeFile(filePath, buffer);
    } else {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: file.type,
        })
      );
    }

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
