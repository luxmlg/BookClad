import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import Redis from "ioredis";
import { WS_MESSAGE_TYPE } from "./constants.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/progress" });

  wss.on("connection", (ws) => {
    // Each WS connection gets its own Redis subscriber for pubsub isolation
    const subscriber = new Redis.default(REDIS_URL, {
      enableReadyCheck: false,
    });
    const subscribedChannels = new Set<string>();

    subscriber.on("message", (channel: string, message: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      // channel is "generation:{id}" — extract the generationId
      const generationId = channel.replace("generation:", "");
      try {
        const event = JSON.parse(message);
        ws.send(
          JSON.stringify({
            generationId,
            ...event,
          })
        );
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === WS_MESSAGE_TYPE.SUBSCRIBE && msg.generationId) {
          const channel = `generation:${msg.generationId}`;
          if (subscribedChannels.has(channel)) return;
          subscribedChannels.add(channel);
          await subscriber.subscribe(channel);
        }

        if (msg.type === WS_MESSAGE_TYPE.UNSUBSCRIBE && msg.generationId) {
          const channel = `generation:${msg.generationId}`;
          if (!subscribedChannels.has(channel)) return;
          subscribedChannels.delete(channel);
          await subscriber.unsubscribe(channel);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", async () => {
      try {
        if (subscribedChannels.size > 0) {
          await subscriber.unsubscribe(...subscribedChannels);
        }
        subscriber.disconnect();
      } catch {
        // Best-effort cleanup
      }
    });

    ws.on("error", () => {
      // Handled by close event
    });
  });

  console.log("[worker] WebSocket server attached at /ws/progress");
  return wss;
}
