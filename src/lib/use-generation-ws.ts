"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GENERATION_STATUS, EVENT_TYPE, WS_MESSAGE_TYPE, DEFAULT_WS_URL, WS_RECONNECT_INITIAL_MS, WS_RECONNECT_MAX_MS, type GenerationStatus } from "@/lib/constants";

interface GenerationProgress {
  status: GenerationStatus;
  progressMessage: string | null;
  errorMessage: string | null;
  step: number;
  totalSteps: number;
  retryCount: number;
  retryReason: string | null;
  nextRetryAt: string | null;
}

type Listener = (event: GenerationProgress & { generationId: string }) => void;

// Singleton WebSocket manager shared across all hook instances
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = WS_RECONNECT_INITIAL_MS;
const listeners = new Map<string, Set<Listener>>();
const subscriptions = new Set<string>();

const WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_WS_URL)
    : "";

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
      reconnectDelay = WS_RECONNECT_INITIAL_MS;
      // Re-subscribe all active subscriptions
      for (const generationId of subscriptions) {
        socket.send(JSON.stringify({ type: WS_MESSAGE_TYPE.SUBSCRIBE, generationId }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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
      if (subscriptions.size > 0) {
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

function subscribe(generationId: string, listener: Listener) {
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
        // If no subscriptions left, clean up connection
        if (subscriptions.size === 0 && ws) {
          ws.close();
          ws = null;
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
        }
      }
    }
  };
}

export function useGenerationProgress(generationId: string) {
  const [status, setStatus] = useState<GenerationStatus>(GENERATION_STATUS.QUEUED);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryReason, setRetryReason] = useState<string | null>(null);
  const [nextRetryAt, setNextRetryAt] = useState<string | null>(null);
  const completedRef = useRef(false);

  const handleEvent = useCallback(
    (event: GenerationProgress & { generationId: string }) => {
      if (completedRef.current) return;
      setStatus(event.status);
      if (event.progressMessage !== null) setProgressMessage(event.progressMessage);
      if (event.errorMessage !== null) setErrorMessage(event.errorMessage);
      if (event.step) setStep(event.step);
      if (event.totalSteps) setTotalSteps(event.totalSteps);
      if (event.retryCount !== undefined) setRetryCount(event.retryCount);
      if (event.retryReason !== undefined) setRetryReason(event.retryReason);
      if (event.nextRetryAt !== undefined) setNextRetryAt(event.nextRetryAt);
      if (event.status === GENERATION_STATUS.COMPLETED || event.status === GENERATION_STATUS.FAILED) {
        completedRef.current = true;
      }
    },
    []
  );

  useEffect(() => {
    completedRef.current = false;
    const unsubscribe = subscribe(generationId, handleEvent);
    return unsubscribe;
  }, [generationId, handleEvent]);

  return { status, progressMessage, errorMessage, step, totalSteps, retryCount, retryReason, nextRetryAt };
}
