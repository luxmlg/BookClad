import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERATION_STATUS } from "@/lib/constants";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where: Record<string, unknown> = {
    project: { userId: session.user.id },
    status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.PROCESSING, GENERATION_STATUS.RETRYING] },
  };
  if (projectId) {
    where.projectId = projectId;
  }

  const generations = await prisma.generation.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      status: true,
      imageCount: true,
      model: true,
      retryCount: true,
      retryReason: true,
      nextRetryAt: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ generations });
}
