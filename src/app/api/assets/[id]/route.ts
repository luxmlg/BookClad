import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { unlink } from "fs/promises";
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

    if (useLocalStorage || !s3) {
      return NextResponse.json({
        url: `/api/uploads/${asset.storageKey}`,
      });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: asset.storageKey,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

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

    if (useLocalStorage || !s3) {
      const filePath = join(process.cwd(), "uploads", asset.storageKey);
      try {
        await unlink(filePath);
      } catch {
        // File may already be deleted; continue with DB cleanup
      }
    } else {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: asset.storageKey,
        })
      );
    }

    await prisma.userAsset.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete asset" },
      { status: 500 }
    );
  }
}
