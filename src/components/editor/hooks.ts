"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type Konva from "konva";
import type { CanvasNode, CanvasState } from "./canvas-types";
import { parseCanvasState } from "./canvas-types";
import {
  getImageUrl,
  updateImage,
  updateProject,
  fireAndForget,
} from "@/lib/api";
import type { GeneratedImage } from "./types";

// ── useLayerCache ───────────────────────────────────────────

interface UseLayerCacheResult {
  layersCacheRef: React.RefObject<Map<string, CanvasNode[]>>;
  getLayersForImage: (imageId: string) => CanvasNode[];
  setNodes: (updater: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => void;
  setNodesRaw: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  nodes: CanvasNode[];
  selectedImageIdRef: React.RefObject<string | null>;
}

export function useLayerCache(
  allImages: GeneratedImage[],
  initialCanvas: CanvasState,
): UseLayerCacheResult {
  const [nodes, setNodesRaw] = useState<CanvasNode[]>(initialCanvas.nodes);
  const layersCacheRef = useRef<Map<string, CanvasNode[]>>(new Map());
  const selectedImageIdRef = useRef<string | null>(null);

  const getLayersForImage = useCallback((imageId: string): CanvasNode[] => {
    const cached = layersCacheRef.current.get(imageId);
    if (cached) return cached;

    const img = allImages.find(i => i.id === imageId);
    if (img?.canvasState) {
      const parsed = parseCanvasState(img.canvasState);
      if (parsed?.nodes?.length) {
        layersCacheRef.current.set(imageId, parsed.nodes);
        return parsed.nodes;
      }
    }

    const template = structuredClone(initialCanvas.nodes);
    layersCacheRef.current.set(imageId, template);
    return template;
  }, [allImages, initialCanvas.nodes]);

  const setNodes = useCallback((updater: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => {
    setNodesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (selectedImageIdRef.current) {
        layersCacheRef.current.set(selectedImageIdRef.current, next);
      }
      return next;
    });
  }, []);

  return { layersCacheRef, getLayersForImage, setNodes, setNodesRaw, nodes, selectedImageIdRef };
}

// ── useAutoSave ─────────────────────────────────────────────

export function useAutoSave(
  nodes: CanvasNode[],
  selectedImageId: string | null,
  projectId: string,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const imageIdToSave = selectedImageId;
    timerRef.current = setTimeout(() => {
      const canvasState: CanvasState = { nodes };
      if (imageIdToSave) {
        fireAndForget(updateImage(imageIdToSave, { canvasState }));
      }
      fireAndForget(updateProject(projectId, { canvasState }));
    }, 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, selectedImageId, projectId]);
}

// ── useToolbarPosition ──────────────────────────────────────

export interface ToolbarPosition {
  top: number;
  left: number;
  width: number;
  minTop: number;
  maxBottom: number;
}

export function useToolbarPosition(
  canvasContainerRef: React.RefObject<HTMLDivElement | null>,
): ToolbarPosition | null {
  const [toolbarPos, setToolbarPos] = useState<ToolbarPosition | null>(null);

  useEffect(() => {
    if (!canvasContainerRef.current) {
      return;
    }
    const scrollParent = canvasContainerRef.current.closest(".overflow-auto");
    const update = () => {
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      const scrollRect = scrollParent?.getBoundingClientRect();
      if (rect) setToolbarPos({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        minTop: scrollRect?.top ?? 0,
        maxBottom: scrollRect?.bottom ?? window.innerHeight,
      });
    };
    update();
    scrollParent?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    let ro: ResizeObserver | undefined;
    if (scrollParent) {
      ro = new ResizeObserver(update);
      ro.observe(scrollParent);
    }
    return () => {
      scrollParent?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [canvasContainerRef]);

  return toolbarPos;
}

// ── useKindlePreview ────────────────────────────────────────

export function useKindlePreview(
  stageRef: React.RefObject<Konva.Stage | null>,
  nodes: CanvasNode[],
  selectedImageUrl: string | undefined,
  bgLoaded: boolean,
): string | null {
  const [kindlePreview, setKindlePreview] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!bgLoaded) return;
    timerRef.current = setTimeout(() => {
      if (!stageRef.current) return;
      try {
        const tr = stageRef.current.findOne("Transformer");
        if (tr) tr.visible(false);
        stageRef.current.draw();
        const dataUrl = stageRef.current.toDataURL({
          pixelRatio: 0.3,
          mimeType: "image/jpeg",
          quality: 0.6,
        });
        if (tr) tr.visible(true);
        stageRef.current.draw();
        setKindlePreview(dataUrl);
      } catch {
        // canvas not ready
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, selectedImageUrl, bgLoaded, stageRef]);

  return kindlePreview;
}

// ── useImageUrls ────────────────────────────────────────────

interface UseImageUrlsResult {
  imageUrls: Record<string, string>;
  setImageUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loadingUrls: boolean;
}

export function useImageUrls(allImages: GeneratedImage[]): UseImageUrlsResult {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);

  useEffect(() => {
    if (allImages.length === 0) return;

    const unfetched = allImages.filter((img) => !imageUrls[img.id]);
    if (unfetched.length === 0) return;

    let cancelled = false;
    const isInitialLoad = Object.keys(imageUrls).length === 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronous loading flag before async fetch is intentional
    if (isInitialLoad) setLoadingUrls(true);

    async function fetchUrls() {
      const newUrls: Record<string, string> = {};
      const results = await Promise.allSettled(
        unfetched.map((img) => getImageUrl(img.id))
      );
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          newUrls[unfetched[i].id] = (results[i] as PromiseFulfilledResult<{ url: string }>).value.url;
        }
      }
      if (!cancelled) {
        setImageUrls((prev) => ({ ...prev, ...newUrls }));
        if (isInitialLoad) setLoadingUrls(false);
      }
    }
    fetchUrls();

    return () => { cancelled = true; };
  }, [allImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { imageUrls, setImageUrls, loadingUrls };
}
