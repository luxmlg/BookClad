import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToStorage, getSignedDownloadUrl } from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const uuid = crypto.randomUUID();
    const storageKey = `feedback/${session.user.id}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToStorage(storageKey, buffer, file.type);
    const url = await getSignedDownloadUrl(storageKey);

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error("Feedback image upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
