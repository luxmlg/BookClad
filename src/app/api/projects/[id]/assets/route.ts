import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DEFAULT_BUCKET } from "@/lib/constants";

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

const bucket = process.env.R2_BUCKET ?? DEFAULT_BUCKET;

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

    const project = await prisma.coverProject.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const assets = await prisma.userAsset.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    const results = await Promise.all(
      assets.map(async (asset) => {
        let url: string;

        if (useLocalStorage || !s3) {
          url = `/api/uploads/${asset.storageKey}`;
        } else {
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: asset.storageKey,
          });
          url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        }

        return {
          id: asset.id,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          url,
        };
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to list assets" },
      { status: 500 }
    );
  }
}
