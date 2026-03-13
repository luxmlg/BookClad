import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
        let url: string;

        if (useLocalStorage || !s3) {
          url = `/api/uploads/${font.storageKey}`;
        } else {
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: font.storageKey,
          });
          url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        }

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
