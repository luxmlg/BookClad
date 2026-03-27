import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { downloadFromStorage, useLocalStorage } from "@/lib/storage";

const UPLOADS_DIR = join(process.cwd(), "uploads");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
};

function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "image/jpeg";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const key = segments.join("/");

    let buffer: Buffer;

    if (useLocalStorage) {
      const filePath = join(UPLOADS_DIR, ...segments);
      if (!filePath.startsWith(UPLOADS_DIR)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await stat(filePath);
      buffer = await readFile(filePath);
    } else {
      buffer = await downloadFromStorage(key);
    }

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": getContentType(key),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
