import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue, getRedisPublisher } from "@/lib/queue";
import { GENERATION_STATUS, EVENT_TYPE } from "@/lib/constants";
import { refundCredits } from "@/lib/credits";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: generationId } = await params;

  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      project: { userId: session.user.id },
    },
    select: {
      id: true,
      status: true,
      creditCost: true,
      project: { select: { userId: true } },
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  if (
    generation.status !== GENERATION_STATUS.RETRYING &&
    generation.status !== GENERATION_STATUS.QUEUED
  ) {
    return NextResponse.json(
      { error: "Can only cancel queued or retrying generations" },
      { status: 400 },
    );
  }

  // Mark as failed and clear retry state
  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: GENERATION_STATUS.FAILED,
      nextRetryAt: null,
      errorMessage: "Cancelled by user",
    },
  });

  // Refund credits
  if (generation.creditCost && generation.creditCost > 0) {
    await refundCredits(
      session.user.id,
      generationId,
      generation.creditCost,
    );
  }

  // Best-effort remove BullMQ job
  try {
    const queue = getGenerationQueue();
    const jobs = await queue.getJobs(["delayed", "waiting"]);
    const matchingJob = jobs.find(
      (j) => j.data?.generationId === generationId,
    );
    if (matchingJob) {
      await matchingJob.remove();
    }
  } catch {
    // Best-effort — cancellation check at job start is authoritative
  }

  // Publish FAILED event via Redis for WebSocket clients
  try {
    const publisher = getRedisPublisher();
    await publisher.publish(
      `generation:${generationId}`,
      JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Cancelled by user" }),
    );
  } catch {
    // Best-effort — polling will catch it
  }

  return NextResponse.json({ success: true });
}
