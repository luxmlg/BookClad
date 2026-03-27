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

  const syncFromApi = useCallback(async () => {
    try {
      const res = await fetch(`/api/generations/active?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.generations);
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
        setGenerations((prev) => prev.filter((g) => g.id !== event.generationId));
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
