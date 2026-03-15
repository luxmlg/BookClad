"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GENERATION_STATUS, DEFAULT_WS_URL, WS_RECONNECT_INITIAL_MS, WS_RECONNECT_MAX_MS, type GenerationStatus } from "@/lib/constants";

interface GenerationProgress {
  status: GenerationStatus;
  progressMessage: string | null;
  step: number;
  totalSteps: number;
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
        socket.send(JSON.stringify({ type: "subscribe", generationId }));
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
        let step = 0;
        let totalSteps = 0;

        switch (rest.type) {
          case "status":
            status = rest.status;
            break;
          case "progress":
            status = GENERATION_STATUS.PROCESSING;
            progressMessage = rest.message;
            step = rest.step;
            totalSteps = rest.totalSteps;
            break;
          case "completed":
            status = GENERATION_STATUS.COMPLETED;
            break;
          case "failed":
            status = GENERATION_STATUS.FAILED;
            break;
          default:
            return;
        }

        for (const listener of genListeners) {
          listener({ generationId, status, progressMessage, step, totalSteps });
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
      socket.send(JSON.stringify({ type: "subscribe", generationId }));
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
          ws.send(JSON.stringify({ type: "unsubscribe", generationId }));
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
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const completedRef = useRef(false);

  const handleEvent = useCallback(
    (event: GenerationProgress & { generationId: string }) => {
      if (completedRef.current) return;
      setStatus(event.status);
      if (event.progressMessage !== null) setProgressMessage(event.progressMessage);
      if (event.step) setStep(event.step);
      if (event.totalSteps) setTotalSteps(event.totalSteps);
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

  return { status, progressMessage, step, totalSteps };
}
