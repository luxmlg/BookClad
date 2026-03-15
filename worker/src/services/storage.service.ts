import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { DEFAULT_BUCKET } from "../lib/constants.js";

const useLocalStorage = !process.env.R2_ENDPOINT;

const UPLOADS_DIR = join(
  process.env.UPLOADS_DIR ?? join(process.cwd(), "..", "uploads")
);

const s3 = useLocalStorage
  ? null
  : new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });

const bucket = process.env.R2_BUCKET ?? DEFAULT_BUCKET;

export async function uploadImage(
  imageBuffer: Buffer,
  prefix: string = "covers"
): Promise<string> {
  const key = `${prefix}/${randomUUID()}.jpg`;

  if (useLocalStorage || !s3) {
    const filePath = join(UPLOADS_DIR, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, imageBuffer);
    console.log(`[storage] Saved locally: ${filePath}`);
    return key;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: imageBuffer,
      ContentType: "image/jpeg",
    })
  );

  return key;
}

export async function downloadImage(storageKey: string): Promise<Buffer> {
  if (useLocalStorage || !s3) {
    const filePath = join(UPLOADS_DIR, storageKey);
    return readFile(filePath);
  }

  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );

  if (!result.Body) throw new Error(`Empty body for key: ${storageKey}`);
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}
