import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "fs/promises";
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

const ALLOWED_EXTENSIONS = ["ttf", "otf", "woff", "woff2"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const MIME_MAP: Record<string, string> = {
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

function toTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const familyField = formData.get("family");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No font file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 2MB limit" },
        { status: 400 }
      );
    }

    const originalName = file.name;
    const ext = originalName.split(".").pop()?.toLowerCase();

    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: .ttf, .otf, .woff, .woff2" },
        { status: 400 }
      );
    }

    const mimeType = MIME_MAP[ext];
    const family =
      typeof familyField === "string" && familyField.trim()
        ? familyField.trim()
        : toTitleCase(originalName.replace(/\.[^.]+$/, ""));

    const uuid = crypto.randomUUID();
    const storageKey = `fonts/${session.user.id}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (useLocalStorage) {
      const dir = join(process.cwd(), "uploads", "fonts", session.user.id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(process.cwd(), "uploads", storageKey), buffer);
    } else {
      await s3!.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    }

    const userFont = await prisma.userFont.upsert({
      where: {
        userId_family: {
          userId: session.user.id,
          family,
        },
      },
      update: {
        storageKey,
        fileName: originalName,
        mimeType,
        fileSize: file.size,
      },
      create: {
        userId: session.user.id,
        family,
        storageKey,
        fileName: originalName,
        mimeType,
        fileSize: file.size,
      },
    });

    const url = useLocalStorage
      ? `/api/uploads/${storageKey}`
      : `/api/fonts/${userFont.id}`;

    return NextResponse.json(
      {
        id: userFont.id,
        family: userFont.family,
        storageKey: userFont.storageKey,
        fileName: userFont.fileName,
        mimeType: userFont.mimeType,
        fileSize: userFont.fileSize,
        url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Font upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload font" },
      { status: 500 }
    );
  }
}
