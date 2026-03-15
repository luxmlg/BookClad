import IORedis from "ioredis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GENERATION_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
  });

  if (!generation) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If already terminal, send the event immediately and close
  if (generation.status === GENERATION_STATUS.COMPLETED || generation.status === GENERATION_STATUS.FAILED) {
    const event =
      generation.status === GENERATION_STATUS.COMPLETED
        ? { type: "completed" }
        : { type: "failed" };
    const body = `data: ${JSON.stringify(event)}\n\n`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const channel = `generation:${id}`;
  const subscriber = new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379"
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "status", status: generation.status })}\n\n`
        )
      );

      subscriber.subscribe(channel);

      subscriber.on("message", (_ch: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));

          const event = JSON.parse(message);
          if (event.type === "completed" || event.type === "failed") {
            cleanup();
            controller.close();
          }
        } catch {
          // Ignore malformed messages
        }
      });

      // Race condition guard: re-check DB after subscribing
      prisma.generation
        .findUnique({ where: { id } })
        .then((gen) => {
          if (
            gen &&
            (gen.status === GENERATION_STATUS.COMPLETED || gen.status === GENERATION_STATUS.FAILED)
          ) {
            const event =
              gen.status === GENERATION_STATUS.COMPLETED
                ? { type: "completed" }
                : { type: "failed" };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            cleanup();
            controller.close();
          }
        })
        .catch(() => {});

      // Heartbeat every 30s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          cleanup();
        }
      }, 30_000);

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        clearInterval(heartbeat);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.disconnect();
      }

      // Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
