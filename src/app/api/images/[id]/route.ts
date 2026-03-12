import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { updateImageSchema } from "@/lib/validations";

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

    const image = await prisma.generatedImage.findFirst({
      where: {
        id,
        generation: { project: { userId: session.user.id } },
      },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (useLocalStorage || !s3) {
      const url = `/api/uploads/${image.storageKey}`;
      return NextResponse.json({ url, image });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: image.storageKey,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return NextResponse.json({ url, image });
  } catch {
    return NextResponse.json(
      { error: "Failed to get image URL" },
      { status: 500 }
    );
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
    const parsed = updateImageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const image = await prisma.generatedImage.findFirst({
      where: {
        id,
        generation: { project: { userId: session.user.id } },
      },
      include: { generation: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (parsed.data.selected) {
      await prisma.generatedImage.updateMany({
        where: { generationId: image.generationId },
        data: { selected: false },
      });
    }

    const updated = await prisma.generatedImage.update({
      where: { id },
      data: { selected: parsed.data.selected },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update image" },
      { status: 500 }
    );
  }
}
