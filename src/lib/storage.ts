import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { join, dirname } from "path";

export const useLocalStorage = !process.env.R2_ENDPOINT;

export const s3 = useLocalStorage
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

export const bucket = process.env.R2_BUCKET ?? "covergen";

/**
 * Returns a URL for downloading the given storage key.
 * Uses a signed S3 URL in production, or a local `/api/uploads/` path in dev.
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  if (useLocalStorage || !s3) {
    return `/api/uploads/${key}`;
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/**
 * Downloads a file from storage and returns its contents as a Buffer.
 */
export async function downloadFromStorage(key: string): Promise<Buffer> {
  if (useLocalStorage || !s3) {
    const filePath = join(process.cwd(), "uploads", key);
    return readFile(filePath);
  }
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error("Empty response body from storage");
  return Buffer.from(bytes);
}

/**
 * Uploads a file to storage (S3 or local filesystem).
 */
export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (useLocalStorage || !s3) {
    const filePath = join(process.cwd(), "uploads", key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
  } else {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}

/**
 * Deletes a file from storage (S3 or local filesystem).
 * Silently ignores missing local files.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  if (useLocalStorage || !s3) {
    const filePath = join(process.cwd(), "uploads", key);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted; ignore
    }
  } else {
    await s3.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  }
}
