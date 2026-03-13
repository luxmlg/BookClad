import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile, unlink } from "fs/promises";
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

const MIME_MAP: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

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

    if (useLocalStorage || !s3) {
      const filePath = join(process.cwd(), "uploads", font.storageKey);
      const buffer = await readFile(filePath);

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: font.storageKey,
    });

    const response = await s3.send(command);
    const body = await response.Body?.transformToByteArray();

    if (!body) {
      return NextResponse.json(
        { error: "Failed to retrieve font file" },
        { status: 500 }
      );
    }

    return new NextResponse(Buffer.from(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    const font = await prisma.userFont.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!font) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.userFont.delete({ where: { id } });

    if (useLocalStorage || !s3) {
      const filePath = join(process.cwd(), "uploads", font.storageKey);
      try {
        await unlink(filePath);
      } catch {
        // File may already be deleted; ignore
      }
    } else {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: font.storageKey,
        })
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete font" },
      { status: 500 }
    );
  }
}
