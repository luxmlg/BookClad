import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGenerationQueue, getRedisPublisher } from "@/lib/queue";
import { GENERATION_STATUS, EVENT_TYPE } from "@/lib/constants";
import { refundCredits } from "@/lib/credits";
import { getPostHogClient } from "@/lib/posthog-server";

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
      projectId: true,
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

  // Atomically mark as failed — status guard prevents double-cancel race
  const updated = await prisma.generation.updateMany({
    where: {
      id: generationId,
      status: { in: [GENERATION_STATUS.QUEUED, GENERATION_STATUS.RETRYING] },
    },
    data: {
      status: GENERATION_STATUS.FAILED,
      nextRetryAt: null,
      errorMessage: "Cancelled by user",
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Generation already cancelled or completed" },
      { status: 409 },
    );
  }

  // Refund credits — only reached if we won the status transition
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
    const failedEvent = JSON.stringify({ type: EVENT_TYPE.FAILED, error: "Cancelled by user" });
    await publisher.publish(`generation:${generationId}`, failedEvent);
    // Also notify project channel for dashboard subscribers
    await publisher.publish(
      `project:${generation.projectId}`,
      JSON.stringify({ generationId, type: EVENT_TYPE.FAILED, error: "Cancelled by user" }),
    );
  } catch {
    // Best-effort
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: session.user.id,
    event: "generation_cancelled",
    properties: {
      generation_id: generationId,
      project_id: generation.projectId,
      prior_status: generation.status,
      credits_refunded: generation.creditCost ?? 0,
    },
  });
  await posthog.shutdown();

  return NextResponse.json({ success: true });
}
