# WebSocket-Only Real-Time Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all generation-related HTTP polling and rely on WebSocket with one-shot HTTP fetches for reliability.

**Architecture:** Extend the existing WebSocket singleton to support project-level subscriptions for the dashboard. Worker dual-publishes status events to both `generation:{id}` and `project:{projectId}` Redis channels. Mount/reconnect one-shot fetches replace polling's safety net role.

**Tech Stack:** WebSocket (ws), ioredis, React hooks, BullMQ

---

### Task 1: Add new WebSocket message types to constants

**Files:**
- Modify: `src/lib/constants.ts:205-208`
- Modify: `worker/src/lib/constants.ts:39-42`

- [ ] **Step 1: Add `SUBSCRIBE_PROJECT` and `UNSUBSCRIBE_PROJECT` to `WS_MESSAGE_TYPE` in `src/lib/constants.ts`**

```ts
export const WS_MESSAGE_TYPE = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  SUBSCRIBE_PROJECT: "subscribe_project",
  UNSUBSCRIBE_PROJECT: "unsubscribe_project",
} as const;
```

- [ ] **Step 2: Remove `POLL_INTERVAL_MS` from `src/lib/constants.ts`**

Delete line 152:
```ts
export const POLL_INTERVAL_MS = 5000;
```

- [ ] **Step 3: Add the same message types to `worker/src/lib/constants.ts`**

```ts
export const WS_MESSAGE_TYPE = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  SUBSCRIBE_PROJECT: "subscribe_project",
  UNSUBSCRIBE_PROJECT: "unsubscribe_project",
} as const;
```

- [ ] **Step 4: Type-check both packages**

Run: `npx tsc --noEmit && cd worker && npx tsc --noEmit`
Expected: FAIL — `generation-poller.tsx` and `active-generation-row.tsx` still import `POLL_INTERVAL_MS`. Skip this check; they'll be rewritten in Tasks 6 and 7. Final type-check in Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts worker/src/lib/constants.ts
git commit -m "feat: add project WebSocket message types, remove POLL_INTERVAL_MS"
```

---

### Task 2: Worker dual-publish — update `publishProgress` and processor

**Files:**
- Modify: `worker/src/lib/progress.ts`
- Modify: `worker/src/processors/generation.processor.ts`

- [ ] **Step 1: Update `publishProgress` signature to accept `projectId` and dual-publish on status events**

Replace the entire `worker/src/lib/progress.ts` with:

```ts
import type { Job } from "bullmq";
import { redisPublisher } from "./redis.js";
import type { GenerationStatus } from "./constants.js";
import { EVENT_TYPE } from "./constants.js";

export type GenerationEvent =
  | { type: typeof EVENT_TYPE.STATUS; status: GenerationStatus }
  | { type: typeof EVENT_TYPE.PROGRESS; message: string; step: number; totalSteps: number }
  | { type: typeof EVENT_TYPE.COMPLETED; errorMessage?: string }
  | { type: typeof EVENT_TYPE.FAILED; error?: string }
  | { type: typeof EVENT_TYPE.RETRYING; retryCount: number; retryReason: string; nextRetryAt: string; errorMessage: string };

/** Events that represent a status transition (not granular progress). */
const STATUS_EVENTS = new Set<string>([
  EVENT_TYPE.STATUS,
  EVENT_TYPE.COMPLETED,
  EVENT_TYPE.FAILED,
  EVENT_TYPE.RETRYING,
]);

export async function publishProgress(
  job: Job,
  generationId: string,
  projectId: string,
  event: GenerationEvent,
) {
  const logMessage =
    event.type === EVENT_TYPE.PROGRESS ? event.message : event.type.toUpperCase();
  job.log(logMessage);
  await redisPublisher.publish(
    `generation:${generationId}`,
    JSON.stringify(event),
  );

  // Dual-publish status transitions to project channel for dashboard subscribers
  if (STATUS_EVENTS.has(event.type)) {
    await redisPublisher.publish(
      `project:${projectId}`,
      JSON.stringify({ generationId, ...event }),
    );
  }
}
```

- [ ] **Step 2: Update all `publishProgress` call sites in `generation.processor.ts` to pass `projectId`**

The processor already destructures `projectId` from `job.data` at line 16. Every `publishProgress(job, generationId, ...)` call becomes `publishProgress(job, generationId, projectId, ...)`.

There are ~12 call sites. Here are all of them with line references:

Line 36: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.STATUS, status: GENERATION_STATUS.PROCESSING });`

Line 104: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.PROGRESS, message: "Downloading reference image...", step, totalSteps });`

Lines 118-123: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.PROGRESS, ... });`

Line 143: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.PROGRESS, message: \`Upscaling image ...\`, step, totalSteps });`

Line 147: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.PROGRESS, message: \`Cropping image ...\`, step, totalSteps });`

Line 155: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.PROGRESS, message: \`Uploading image ...\`, step, totalSteps });`

Line 174: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.COMPLETED });`

Line 235-238: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.FAILED, error: errorMsg });` (extension path)

Lines 277-283: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.RETRYING, ... });`

Lines 310-313: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.COMPLETED, errorMessage: partialMsg });`

Lines 325-328: `await publishProgress(job, generationId, projectId, { type: EVENT_TYPE.FAILED, error: errorMsg });`

Use find-and-replace: change `publishProgress(job, generationId,` to `publishProgress(job, generationId, projectId,` throughout the file. This is safe because `generationId` is always followed by the event object, and `projectId` is always in scope from the destructure at line 16.

- [ ] **Step 3: Type-check the worker**

Run: `cd worker && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add worker/src/lib/progress.ts worker/src/processors/generation.processor.ts
git commit -m "feat: dual-publish generation events to project channel"
```

---

### Task 3: Worker WebSocket server — handle project subscriptions

**Files:**
- Modify: `worker/src/lib/websocket.ts`

- [ ] **Step 1: Update the WebSocket server to handle project subscriptions and route messages by channel prefix**

Replace the entire `worker/src/lib/websocket.ts` with:

```ts
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
      try {
        const event = JSON.parse(message);
        if (channel.startsWith("project:")) {
          const projectId = channel.slice("project:".length);
          ws.send(JSON.stringify({ projectId, ...event }));
        } else {
          const generationId = channel.replace("generation:", "");
          ws.send(JSON.stringify({ generationId, ...event }));
        }
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

        if (msg.type === WS_MESSAGE_TYPE.SUBSCRIBE_PROJECT && msg.projectId) {
          const channel = `project:${msg.projectId}`;
          if (subscribedChannels.has(channel)) return;
          subscribedChannels.add(channel);
          await subscriber.subscribe(channel);
        }

        if (msg.type === WS_MESSAGE_TYPE.UNSUBSCRIBE_PROJECT && msg.projectId) {
          const channel = `project:${msg.projectId}`;
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
```

- [ ] **Step 2: Type-check the worker**

Run: `cd worker && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add worker/src/lib/websocket.ts
git commit -m "feat: handle project channel subscriptions in WebSocket server"
```

---

### Task 4: Cancel API — dual-publish to project channel

**Files:**
- Modify: `src/app/api/generations/[id]/cancel/route.ts`

- [ ] **Step 1: Add `projectId` to the Prisma select and dual-publish to project channel**

In the Prisma query (lines 19-30), add `projectId` to the select:

```ts
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
```

Then update the Redis publish block (lines 79-88) to also publish to the project channel:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (or deferred — `POLL_INTERVAL_MS` import errors may still exist in other files)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generations/[id]/cancel/route.ts
git commit -m "feat: cancel API publishes to project channel for dashboard"
```

---

### Task 5: Rewrite WebSocket singleton — project subscriptions, reconnect sync, onComplete

**Files:**
- Modify: `src/lib/use-generation-ws.ts`
- Modify: `src/lib/api/generations.ts`

This is the largest task. The singleton gains project subscription support, reconnect-sync, and `useGenerationProgress` gets `onComplete` + mount fetch.

- [ ] **Step 1: Rename `GenerationPollData` to `GenerationStatusData` in `src/lib/api/generations.ts`**

Change:
```ts
export interface GenerationPollData {
```
to:
```ts
export interface GenerationStatusData {
```

And change the function return type:
```ts
export async function getGeneration(id: string): Promise<GenerationStatusData> {
  const { data } = await api.get<GenerationStatusData>(`/api/generations/${id}`);
  return data;
}
```

- [ ] **Step 2: Rewrite `src/lib/use-generation-ws.ts`**

Replace the entire file with:

```ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GENERATION_STATUS, EVENT_TYPE, WS_MESSAGE_TYPE, DEFAULT_WS_URL, WS_RECONNECT_INITIAL_MS, WS_RECONNECT_MAX_MS, type GenerationStatus } from "@/lib/constants";
import { getGeneration } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────

export interface GenerationProgress {
  status: GenerationStatus;
  progressMessage: string | null;
  errorMessage: string | null;
  step: number;
  totalSteps: number;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string | null;
}

type GenerationListener = (event: GenerationProgress & { generationId: string }) => void;

export interface ProjectGenerationEvent {
  projectId: string;
  generationId: string;
  type: string;
  status?: GenerationStatus;
  imageCount?: number;
  errorMessage?: string | null;
  retryCount?: number;
  retryReason?: string | null;
  nextRetryAt?: string | null;
}

type ProjectListener = (event: ProjectGenerationEvent) => void;

// ── Singleton state ──────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = WS_RECONNECT_INITIAL_MS;
let isReconnect = false;

// Generation subscriptions
const listeners = new Map<string, Set<GenerationListener>>();
const subscriptions = new Set<string>();

// Project subscriptions
const projectListeners = new Map<string, Set<ProjectListener>>();
const projectSubscriptions = new Set<string>();

// Reconnect callbacks
const reconnectCallbacks = new Set<() => void>();

const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS_URL)
    : "";

// ── Socket management ────────────────────────────────────────────

function getSocket(): WebSocket | null {
  if (typeof window === "undefined") return null;
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  if (ws && ws.readyState === WebSocket.CONNECTING) return ws;

  // Clean up dead socket
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws = null;
  }

  try {
    const socket = new WebSocket(WS_URL);
    ws = socket;

    socket.onopen = () => {
      const wasReconnect = isReconnect;
      isReconnect = true;
      reconnectDelay = WS_RECONNECT_INITIAL_MS;

      // Re-subscribe all active generation subscriptions
      for (const generationId of subscriptions) {
        socket.send(JSON.stringify({ type: WS_MESSAGE_TYPE.SUBSCRIBE, generationId }));
      }
      // Re-subscribe all active project subscriptions
      for (const projectId of projectSubscriptions) {
        socket.send(JSON.stringify({ type: WS_MESSAGE_TYPE.SUBSCRIBE_PROJECT, projectId }));
      }

      // Fire reconnect callbacks to sync state missed during gap
      if (wasReconnect) {
        for (const cb of reconnectCallbacks) {
          cb();
        }
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Route project channel messages
        if (data.projectId) {
          const pListeners = projectListeners.get(data.projectId);
          if (pListeners) {
            for (const listener of pListeners) {
              listener(data as ProjectGenerationEvent);
            }
          }
          return;
        }

        // Route generation channel messages
        const { generationId, ...rest } = data;
        if (!generationId) return;

        const genListeners = listeners.get(generationId);
        if (!genListeners) return;

        let status: GenerationStatus = GENERATION_STATUS.QUEUED;
        let progressMessage: string | null = null;
        let errorMessage: string | null = null;
        let step = 0;
        let totalSteps = 0;
        let retryCount = 0;
        let retryReason: string | null = null;
        let nextRetryAt: string | null = null;

        switch (rest.type) {
          case EVENT_TYPE.STATUS:
            status = rest.status;
            break;
          case EVENT_TYPE.PROGRESS:
            status = GENERATION_STATUS.PROCESSING;
            progressMessage = rest.message;
            step = rest.step;
            totalSteps = rest.totalSteps;
            break;
          case EVENT_TYPE.COMPLETED:
            status = GENERATION_STATUS.COMPLETED;
            errorMessage = (data as { errorMessage?: string }).errorMessage ?? null;
            break;
          case EVENT_TYPE.FAILED:
            status = GENERATION_STATUS.FAILED;
            errorMessage = rest.error ?? null;
            break;
          case EVENT_TYPE.RETRYING:
            status = GENERATION_STATUS.RETRYING;
            errorMessage = rest.errorMessage ?? null;
            retryCount = rest.retryCount ?? 0;
            retryReason = rest.retryReason ?? null;
            nextRetryAt = rest.nextRetryAt ?? null;
            break;
          default:
            return;
        }

        for (const listener of genListeners) {
          listener({ generationId, status, progressMessage, errorMessage, step, totalSteps, retryCount, retryReason, nextRetryAt });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => {
      if (ws === socket) ws = null;
      const hasSubscriptions = subscriptions.size > 0 || projectSubscriptions.size > 0;
      if (hasSubscriptions) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          getSocket();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, WS_RECONNECT_MAX_MS);
      }
    };

    socket.onerror = () => {
      // Close event will handle reconnection
    };
  } catch {
    ws = null;
  }

  return ws;
}

function cleanupIfEmpty() {
  if (subscriptions.size === 0 && projectSubscriptions.size === 0 && ws) {
    ws.close();
    ws = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
}

// ── Generation subscriptions ─────────────────────────────────────

function subscribe(generationId: string, listener: GenerationListener) {
  if (!listeners.has(generationId)) {
    listeners.set(generationId, new Set());
  }
  listeners.get(generationId)!.add(listener);

  const isNew = !subscriptions.has(generationId);
  subscriptions.add(generationId);

  if (isNew) {
    const socket = getSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: WS_MESSAGE_TYPE.SUBSCRIBE, generationId }));
    }
  }

  return () => {
    const genListeners = listeners.get(generationId);
    if (genListeners) {
      genListeners.delete(listener);
      if (genListeners.size === 0) {
        listeners.delete(generationId);
        subscriptions.delete(generationId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: WS_MESSAGE_TYPE.UNSUBSCRIBE, generationId }));
        }
        cleanupIfEmpty();
      }
    }
  };
}

// ── Project subscriptions ────────────────────────────────────────

function subscribeProject(projectId: string, listener: ProjectListener) {
  if (!projectListeners.has(projectId)) {
    projectListeners.set(projectId, new Set());
  }
  projectListeners.get(projectId)!.add(listener);

  const isNew = !projectSubscriptions.has(projectId);
  projectSubscriptions.add(projectId);

  if (isNew) {
    const socket = getSocket();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: WS_MESSAGE_TYPE.SUBSCRIBE_PROJECT, projectId }));
    }
  }

  return () => {
    const pListeners = projectListeners.get(projectId);
    if (pListeners) {
      pListeners.delete(listener);
      if (pListeners.size === 0) {
        projectListeners.delete(projectId);
        projectSubscriptions.delete(projectId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: WS_MESSAGE_TYPE.UNSUBSCRIBE_PROJECT, projectId }));
        }
        cleanupIfEmpty();
      }
    }
  };
}

// ── Reconnect callback registration ─────────────────────────────

function onReconnect(cb: () => void) {
  reconnectCallbacks.add(cb);
  return () => { reconnectCallbacks.delete(cb); };
}

// ── Hook: useGenerationProgress ──────────────────────────────────

interface UseGenerationProgressOptions {
  onComplete?: (status: GenerationStatus, errorMessage?: string | null) => void;
}

export function useGenerationProgress(
  generationId: string,
  options?: UseGenerationProgressOptions,
) {
  const [status, setStatus] = useState<GenerationStatus>(GENERATION_STATUS.QUEUED);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryReason, setRetryReason] = useState<string | null>(null);
  const [nextRetryAt, setNextRetryAt] = useState<string | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;

  const applyState = useCallback(
    (data: {
      status: GenerationStatus;
      progressMessage?: string | null;
      errorMessage?: string | null;
      step?: number;
      totalSteps?: number;
      retryCount?: number;
      retryReason?: string | null;
      nextRetryAt?: string | null;
    }) => {
      if (completedRef.current) return;
      setStatus(data.status);
      if (data.progressMessage !== undefined && data.progressMessage !== null) setProgressMessage(data.progressMessage);
      if (data.errorMessage !== undefined && data.errorMessage !== null) setErrorMessage(data.errorMessage);
      if (data.step) setStep(data.step);
      if (data.totalSteps) setTotalSteps(data.totalSteps);
      if (data.retryCount !== undefined) setRetryCount(data.retryCount);
      if (data.retryReason !== undefined) setRetryReason(data.retryReason);
      if (data.nextRetryAt !== undefined) setNextRetryAt(data.nextRetryAt);
      if (data.status === GENERATION_STATUS.COMPLETED || data.status === GENERATION_STATUS.FAILED) {
        completedRef.current = true;
        onCompleteRef.current?.(data.status, data.errorMessage);
      }
    },
    [],
  );

  const handleEvent = useCallback(
    (event: GenerationProgress & { generationId: string }) => {
      applyState(event);
    },
    [applyState],
  );

  // One-shot fetch for initialization and reconnect sync
  const syncFromApi = useCallback(async () => {
    if (completedRef.current) return;
    try {
      const data = await getGeneration(generationId);
      applyState({
        status: data.status as GenerationStatus,
        errorMessage: data.errorMessage,
        retryCount: data.retryCount ?? 0,
        retryReason: data.retryReason ?? null,
        nextRetryAt: data.nextRetryAt ? String(data.nextRetryAt) : null,
      });
    } catch {
      // Ignore fetch errors
    }
  }, [generationId, applyState]);

  useEffect(() => {
    completedRef.current = false;
    const unsubscribe = subscribe(generationId, handleEvent);
    // One-shot fetch on mount for initial state
    syncFromApi();
    // Re-sync on reconnect
    const unregReconnect = onReconnect(syncFromApi);
    return () => {
      unsubscribe();
      unregReconnect();
    };
  }, [generationId, handleEvent, syncFromApi]);

  const progressPercent =
    totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return { status, progressMessage, errorMessage, step, totalSteps, progressPercent, retryCount, retryReason, nextRetryAt };
}

// ── Hook: useProjectGenerations ──────────────────────────────────

interface ActiveGeneration {
  id: string;
  projectId: string;
  status: string;
  imageCount: number;
  model: string | null;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: Date | string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

export function useProjectGenerations(
  projectId: string,
  initialGenerations: ActiveGeneration[],
) {
  const [generations, setGenerations] = useState(initialGenerations);
  const completedRef = useRef(false);

  const syncFromApi = useCallback(async () => {
    try {
      const res = await fetch(`/api/generations/active?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations);
        if (data.generations.length === 0) {
          completedRef.current = true;
        }
      }
    } catch {
      // Ignore fetch errors
    }
  }, [projectId]);

  const handleEvent = useCallback(
    (event: ProjectGenerationEvent) => {
      const isTerminal =
        event.status === GENERATION_STATUS.COMPLETED ||
        event.status === GENERATION_STATUS.FAILED;

      if (isTerminal) {
        // Remove completed/failed generation from list
        setGenerations((prev) => {
          const next = prev.filter((g) => g.id !== event.generationId);
          if (next.length === 0) completedRef.current = true;
          return next;
        });
      } else {
        // Update existing generation's status fields
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === event.generationId
              ? {
                  ...g,
                  status: event.status ?? g.status,
                  retryCount: event.retryCount ?? g.retryCount,
                  retryReason: event.retryReason ?? g.retryReason,
                  nextRetryAt: event.nextRetryAt ?? g.nextRetryAt,
                  errorMessage: event.errorMessage ?? g.errorMessage,
                }
              : g,
          ),
        );
      }
    },
    [],
  );

  useEffect(() => {
    completedRef.current = false;
    const unsubscribe = subscribeProject(projectId, handleEvent);
    // One-shot fetch on mount
    syncFromApi();
    // Re-sync on reconnect
    const unregReconnect = onReconnect(syncFromApi);
    return () => {
      unsubscribe();
      unregReconnect();
    };
  }, [projectId, handleEvent, syncFromApi]);

  return { generations };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: May still fail due to `generation-poller.tsx` importing deleted `POLL_INTERVAL_MS` and the old `syncState`. That's expected — fixed in next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/use-generation-ws.ts src/lib/api/generations.ts
git commit -m "feat: WebSocket singleton with project subscriptions, reconnect sync, onComplete"
```

---

### Task 6: Rewrite `generation-queue.tsx` — remove poller dependency

**Files:**
- Modify: `src/components/editor/generation-queue.tsx`

- [ ] **Step 1: Replace `useGenerationPoller` with `useGenerationProgress` and inline the completion logic**

Replace the entire file with:

```ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GENERATION_STATUS, JOB_TYPE, MAX_OTHER_RETRIES, type GenerationStatus } from "@/lib/constants";
import { useGenerationProgress } from "@/lib/use-generation-ws";
import type { Generation } from "./types";
import {
  JOB_TYPE_ICON,
  getModelLabel,
  formatRelativeTime,
} from "./generation-helpers";
import { asAttributeSnapshot } from "./types";
import { formatAttributes } from "@/lib/attributes";
import { cancelGeneration } from "@/lib/api";

interface GenerationQueueProps {
  generations: Generation[];
  onComplete: (generationId: string, status: GenerationStatus) => void;
  onSelectGeneration?: (generationId: string) => void;
  tier?: string;
}

export function GenerationQueue({
  generations,
  onComplete,
  onSelectGeneration,
  tier,
}: GenerationQueueProps) {
  // Tick counter to keep relative times fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    if (generations.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, [generations.length]);

  if (generations.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
        No active generations
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      <div className="space-y-2">
        {generations.map((gen) => (
          <QueueEntry
            key={gen.id}
            generation={gen}
            onComplete={onComplete}
            onSelectGeneration={onSelectGeneration}
            tier={tier}
          />
        ))}
      </div>
    </div>
  );
}

const PRIORITY_TIERS = new Set(["PRO", "STUDIO"]);

function QueueEntry({
  generation,
  onComplete,
  onSelectGeneration,
  tier,
}: {
  generation: Generation;
  onComplete: (generationId: string, status: GenerationStatus) => void;
  onSelectGeneration?: (generationId: string) => void;
  tier?: string;
}) {
  const router = useRouter();
  const isPriorityUser = tier !== undefined && PRIORITY_TIERS.has(tier);

  const handleComplete = useCallback(
    (status: GenerationStatus, errorMsg?: string | null) => {
      if (status === GENERATION_STATUS.FAILED) {
        toast.error(errorMsg ?? "Generation failed. Please try again.");
      } else if (errorMsg) {
        toast.warning(errorMsg);
      } else {
        toast.success("Cover generation complete!");
      }
      router.refresh();
      onComplete(generation.id, status);
    },
    [generation.id, onComplete, router],
  );

  const { status, progressMessage, errorMessage, step, totalSteps, progressPercent, retryCount, retryReason, nextRetryAt } =
    useGenerationProgress(generation.id, { onComplete: handleComplete });

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;
  const timeStr = formatRelativeTime(date);

  const jobType = generation.jobType ?? JOB_TYPE.GENERATE;
  const Icon = JOB_TYPE_ICON[jobType] ?? Sparkles;
  const modelLabel = getModelLabel(generation.model);
  const attrs = asAttributeSnapshot(generation.attributeSnapshot);
  const imageCount = generation.imageCount ?? generation.images.length;

  const isActive =
    status === GENERATION_STATUS.QUEUED ||
    status === GENERATION_STATUS.PROCESSING ||
    status === GENERATION_STATUS.RETRYING;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 cursor-pointer hover:bg-muted/40 transition-colors ${
        status === GENERATION_STATUS.RETRYING
          ? retryReason === "high_demand"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-destructive/30 bg-destructive/5"
          : "bg-muted/30"
      }`}
      onClick={() => onSelectGeneration?.(generation.id)}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 text-sm">
        <Icon className="size-3.5 text-muted-foreground shrink-0" />
        {imageCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {imageCount} {imageCount === 1 ? "image" : "images"}
          </span>
        )}
        <span
          className="ml-auto text-xs text-muted-foreground"
          title={date.toLocaleString()}
        >
          {timeStr}
        </span>
        {isPriorityUser && status === GENERATION_STATUS.QUEUED && (
          <span className="text-xs text-amber-600 font-medium">Priority</span>
        )}
        {modelLabel && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {modelLabel}
          </Badge>
        )}
        {isActive && (
          <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" />
        )}
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs">
        <div className="text-muted-foreground italic">
          {generation.images.length > 0
            ? `Generating ${imageCount - generation.images.length} more images`
            : "Prompt generated by AI"}
        </div>

        {attrs && (
          <div className="text-muted-foreground">{formatAttributes(attrs)}</div>
        )}
      </div>

      {/* Progress */}
      <QueueProgress
        status={status}
        progressMessage={progressMessage}
        errorMessage={errorMessage}
        step={step}
        totalSteps={totalSteps}
        progressPercent={progressPercent}
        retryCount={retryCount}
        retryReason={retryReason}
        nextRetryAt={nextRetryAt}
        generationId={generation.id}
        onCancel={() => onComplete(generation.id, GENERATION_STATUS.FAILED)}
      />
    </div>
  );
}

interface QueueProgressProps {
  status: GenerationStatus;
  progressMessage: string | null;
  errorMessage: string | null;
  step: number;
  totalSteps: number;
  progressPercent: number;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string | null;
  generationId: string;
  onCancel: () => void;
}

function QueueProgress({
  status,
  progressMessage,
  errorMessage,
  progressPercent,
  step,
  totalSteps,
  retryCount,
  retryReason,
  nextRetryAt,
  generationId,
  onCancel,
}: QueueProgressProps) {
  if (status === GENERATION_STATUS.QUEUED) {
    return (
      <QueueCancelRow
        generationId={generationId}
        onCancel={onCancel}
        message="Waiting in queue..."
      />
    );
  }

  if (status === GENERATION_STATUS.PROCESSING) {
    return (
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-1.5" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{progressMessage || "Starting..."}</span>
          {totalSteps > 0 && (
            <span className="ml-auto tabular-nums">
              {step}/{totalSteps}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (status === GENERATION_STATUS.RETRYING && nextRetryAt) {
    return (
      <RetryingProgress
        retryCount={retryCount}
        retryReason={retryReason}
        nextRetryAt={nextRetryAt}
        errorMessage={errorMessage}
        generationId={generationId}
        onCancel={onCancel}
      />
    );
  }

  if (status === GENERATION_STATUS.COMPLETED) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-muted-foreground">Loading results...</span>
      </div>
    );
  }

  return null;
}

function QueueCancelRow({
  generationId,
  onCancel,
  message,
}: {
  generationId: string;
  onCancel: () => void;
  message: string;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelling(true);
      try {
        await cancelGeneration(generationId);
        onCancel();
      } catch {
        setCancelling(false);
      }
    },
    [generationId, onCancel],
  );

  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="flex-1 text-xs text-muted-foreground">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
        onClick={handleCancel}
        disabled={cancelling}
      >
        {cancelling ? "Cancelling..." : "Cancel"}
      </Button>
    </div>
  );
}

function RetryingProgress({
  retryCount,
  retryReason,
  nextRetryAt,
  errorMessage,
  generationId,
  onCancel,
}: {
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string;
  errorMessage: string | null;
  generationId: string;
  onCancel: () => void;
}) {
  const [countdown, setCountdown] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const isHighDemand = retryReason === "high_demand";

  useEffect(() => {
    const target = new Date(nextRetryAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(`${remaining}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRetryAt]);

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelling(true);
      try {
        await cancelGeneration(generationId);
        onCancel();
      } catch {
        setCancelling(false);
      }
    },
    [generationId, onCancel],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`size-3.5 shrink-0 ${isHighDemand ? "text-amber-500" : "text-destructive"}`}
        />
        <span
          className={`text-xs font-medium ${isHighDemand ? "text-amber-500" : "text-destructive"}`}
        >
          {isHighDemand ? "High demand" : "Retrying"} · Retrying in {countdown}
        </span>
        <span className="text-xs text-muted-foreground">
          · Attempt {retryCount}
          {!isHighDemand ? ` of ${MAX_OTHER_RETRIES}` : ""}
        </span>
      </div>
      {errorMessage && (
        <p className="text-xs text-muted-foreground">{errorMessage}</p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-destructive hover:text-destructive"
        onClick={handleCancel}
        disabled={cancelling}
      >
        <X className="mr-1 size-3" />
        {cancelling ? "Cancelling..." : "Cancel"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: May still fail due to `generation-poller.tsx` and `active-generation-row.tsx`. Addressed next.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/generation-queue.tsx
git commit -m "refactor: generation queue uses WebSocket-only progress"
```

---

### Task 7: Rewrite `active-generation-row.tsx` — WebSocket instead of polling

**Files:**
- Modify: `src/components/dashboard/active-generation-row.tsx`

- [ ] **Step 1: Replace polling with `useProjectGenerations` hook**

Replace the entire file with:

```ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GENERATION_STATUS } from "@/lib/constants";
import { cancelGeneration } from "@/lib/api";
import { getModelLabel, formatRelativeTime } from "@/components/editor/generation-helpers";
import { useProjectGenerations } from "@/lib/use-generation-ws";

interface ActiveGeneration {
  id: string;
  projectId: string;
  status: string;
  imageCount: number;
  model: string | null;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: Date | string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

interface ActiveGenerationRowsProps {
  projectId: string;
  initialGenerations: ActiveGeneration[];
}

export function ActiveGenerationRows({ projectId, initialGenerations }: ActiveGenerationRowsProps) {
  const router = useRouter();
  const { generations } = useProjectGenerations(projectId, initialGenerations);

  // Refresh server components when all generations complete
  useEffect(() => {
    if (initialGenerations.length > 0 && generations.length === 0) {
      router.refresh();
    }
  }, [generations.length, initialGenerations.length, router]);

  if (generations.length === 0) return null;

  return (
    <div className="border-t border-border/50">
      {generations.map((gen) => (
        <DashboardGenRow
          key={gen.id}
          generation={gen}
          projectId={projectId}
          onCancelled={() => router.refresh()}
        />
      ))}
    </div>
  );
}

interface DashboardGenRowProps {
  generation: ActiveGeneration;
  projectId: string;
  onCancelled: () => void;
}

function DashboardGenRow({ generation, projectId, onCancelled }: DashboardGenRowProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [countdown, setCountdown] = useState("");
  const isRetrying = generation.status === GENERATION_STATUS.RETRYING;
  const isHighDemand = generation.retryReason === "high_demand";

  useEffect(() => {
    if (!isRetrying || !generation.nextRetryAt) return;
    const target = new Date(generation.nextRetryAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCountdown(`${remaining}s`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRetrying, generation.nextRetryAt]);

  const handleCancel = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelling(true);
      try {
        await cancelGeneration(generation.id);
        toast.success("Generation cancelled — credits refunded");
        onCancelled();
      } catch {
        setCancelling(false);
        toast.error("Failed to cancel generation");
      }
    },
    [generation.id, onCancelled],
  );

  const handleClick = () => {
    router.push(`/editor/${projectId}?tab=history&gen=${generation.id}`);
  };

  const date =
    typeof generation.createdAt === "string"
      ? new Date(generation.createdAt)
      : generation.createdAt;

  const modelLabel = getModelLabel(generation.model ?? undefined);

  let dotColor = "bg-primary";
  let label = `Generating ${generation.imageCount} images`;
  if (isRetrying) {
    dotColor = isHighDemand ? "bg-amber-500" : "bg-destructive";
    label = isHighDemand
      ? `High demand · Retry ${generation.retryCount}`
      : `Retrying · Attempt ${generation.retryCount}`;
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-xs"
      onClick={handleClick}
    >
      <div className={`size-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            className={
              isRetrying
                ? isHighDemand
                  ? "text-amber-500"
                  : "text-destructive"
                : "text-muted-foreground"
            }
          >
            {label}
          </span>
          {isRetrying && countdown && (
            <span className="text-muted-foreground">· {countdown}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>
            {generation.imageCount} imgs{modelLabel ? ` · ${modelLabel}` : ""}
          </span>
          <span>· {formatRelativeTime(date)}</span>
        </div>
      </div>
      {!isRetrying && (
        <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
      )}
      {isRetrying && (
        <button
          className="shrink-0 rounded border border-destructive/40 px-1.5 py-0.5 text-[9px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? "..." : "Cancel"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Should pass now or very close — only `generation-poller.tsx` remains as a dead file.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/active-generation-row.tsx
git commit -m "refactor: dashboard uses WebSocket for active generation updates"
```

---

### Task 8: Delete dead files and clean up CLAUDE.md

**Files:**
- Delete: `src/components/editor/generation-poller.tsx`
- Delete: `src/app/api/generations/[id]/events/route.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Delete `generation-poller.tsx`**

```bash
rm src/components/editor/generation-poller.tsx
```

- [ ] **Step 2: Delete the unused SSE route**

```bash
rm src/app/api/generations/[id]/events/route.ts
```

If the `events/` directory is now empty, also remove it:
```bash
rmdir src/app/api/generations/[id]/events/
```

- [ ] **Step 3: Type-check both packages**

Run: `npx tsc --noEmit && cd worker && npx tsc --noEmit`
Expected: PASS — no remaining imports of deleted files

- [ ] **Step 4: Update CLAUDE.md**

In the "Editor Architecture" section, replace the line:
```
- **Bottom panel tabs**: Both History and Queue tabs are **always mounted** (CSS `hidden`, not conditional rendering) in `EditorCenterPanel`. The Queue's `useGenerationPoller` hooks stay alive regardless of active tab — no duplicate pollers needed in History.
```
with:
```
- **Bottom panel tabs**: Both History and Queue tabs are **always mounted** (CSS `hidden`, not conditional rendering) in `EditorCenterPanel`. The Queue's `useGenerationProgress` hooks stay alive regardless of active tab.
```

In the "WebSocket" convention, replace the line:
```
- **WebSocket**: Singleton manager in `src/lib/use-generation-ws.ts`. Worker endpoint at `NEXT_PUBLIC_WS_URL` (defaults to `ws://localhost:4000/ws/progress`). Falls back to HTTP polling if WebSocket fails. The worker bridges Redis pubsub → WebSocket: `publishProgress()` in `worker/src/lib/progress.ts` publishes to `generation:{id}` channels, and `worker/src/lib/websocket.ts` relays those to connected clients.
```
with:
```
- **WebSocket**: Singleton manager in `src/lib/use-generation-ws.ts`. Worker endpoint at `NEXT_PUBLIC_WS_URL` (defaults to `ws://localhost:4000/ws/progress`). No polling fallback — reliability is ensured by one-shot HTTP fetches on mount and WebSocket reconnect. Supports two subscription types: `generation:{id}` (granular progress for editor) and `project:{projectId}` (status transitions for dashboard). The worker bridges Redis pubsub → WebSocket: `publishProgress()` in `worker/src/lib/progress.ts` publishes to both channels, and `worker/src/lib/websocket.ts` relays to connected clients. Hooks: `useGenerationProgress(id, options?)` for per-generation progress, `useProjectGenerations(projectId, initial)` for dashboard active generations.
```

In the "Key data flow" section (line 23), replace:
```
4. Editor receives real-time progress via WebSocket (singleton in `src/lib/use-generation-ws.ts`, falls back to HTTP polling)
```
with:
```
4. Editor receives real-time progress via WebSocket (singleton in `src/lib/use-generation-ws.ts`, one-shot HTTP fetch on mount/reconnect for reliability)
```

In the "Important Conventions" section (line 342), replace:
```
- **Dashboard active generations**: `src/components/dashboard/active-generation-row.tsx` (client component) renders active generation rows under project cards on the dashboard. Polls `GET /api/generations/active?projectId=X` every 5s. Clicking navigates to the editor with `?tab=history&gen=ID`.
```
with:
```
- **Dashboard active generations**: `src/components/dashboard/active-generation-row.tsx` (client component) renders active generation rows under project cards on the dashboard. Uses `useProjectGenerations` hook (WebSocket subscription to `project:{projectId}` channel) with one-shot HTTP fetch on mount/reconnect. Clicking navigates to the editor with `?tab=history&gen=ID`.
```

- [ ] **Step 5: Lint check**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove polling files, SSE route, update CLAUDE.md"
```

---

### Task 9: Manual verification

- [ ] **Step 1: Start infrastructure**

```bash
docker compose up -d postgres redis
```

- [ ] **Step 2: Start both processes**

```bash
npm run dev           # Terminal 1
npm run dev:worker    # Terminal 2
```

- [ ] **Step 3: Test editor generation progress**

1. Open the editor for a project
2. Trigger a generation
3. Verify progress messages appear in real-time via WebSocket (check browser DevTools Network → WS tab)
4. Verify generation completes with toast notification
5. Verify no 5s polling requests in Network tab (no repeated `GET /api/generations/{id}`)

- [ ] **Step 4: Test dashboard active generations**

1. Open the dashboard in one tab
2. Trigger a generation from the editor in another tab
3. Verify the dashboard shows the active generation row updating via WebSocket
4. Verify generation completion removes the row and refreshes the page
5. Verify no repeated `GET /api/generations/active` requests in Network tab

- [ ] **Step 5: Test cancellation**

1. Start a generation, then cancel it from the queue
2. Verify the dashboard also reflects the cancellation in real-time

- [ ] **Step 6: Test reconnection**

1. Start a generation
2. Kill the worker process mid-generation
3. Restart the worker
4. Verify the WebSocket reconnects and syncs state via one-shot fetch
