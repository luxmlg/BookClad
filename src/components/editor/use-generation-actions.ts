"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CanvasNode } from "./canvas-types";
import { NODE_TYPE } from "./canvas-types";
import { GENERATION_STATUS, IMAGE_COUNT_KEY_PREFIX, QUICK_CREATE_TIER_CONFIG, isModelAvailable, AI_MODELS } from "@/lib/constants";
import type { AttributeSelection } from "@/lib/attributes";
import { REF_PROMPT_KEY } from "@/lib/attributes";
import { createGeneration, extendGeneration } from "@/lib/api";
import { useCreditStore } from "@/lib/stores/credit-store";
import type { Generation } from "./types";
import type { UseInpaintStateResult } from "./use-inpaint-state";

export interface UseGenerationActionsResult {
  activeGenerationIds: string[];
  setActiveGenerationIds: React.Dispatch<React.SetStateAction<string[]>>;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  imageCount: number;
  setImageCount: React.Dispatch<React.SetStateAction<number>>;
  activeTab: number;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
  panelOpen: boolean;
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingSlotCounts: Map<string, number>;
  setPendingSlotCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  handleRegenerate: () => Promise<void>;
  handleGenerateSimilar: (prompt: string) => Promise<void>;
  handleGenerateMore: (generation: Generation, imageCount: number) => Promise<void>;
  handleGenerationComplete: (generationId: string) => void;
  allActiveIds: string[];
  activeGenerations: Generation[];
  hasActiveGeneration: boolean;
}

export function useGenerationActions(
  projectId: string,
  projectGenerations: Generation[],
  attributes: AttributeSelection,
  canvasNodes: CanvasNode[],
  selectedImageId: string | null,
  inpaintRef: React.RefObject<Pick<UseInpaintStateResult, "includeLayers" | "flattenCanvasToDataUrl">>,
  router: ReturnType<typeof useRouter>,
  tier: string = "FREE",
): UseGenerationActionsResult {
  const tierConfig = QUICK_CREATE_TIER_CONFIG[tier as keyof typeof QUICK_CREATE_TIER_CONFIG] ?? QUICK_CREATE_TIER_CONFIG.FREE;
  const refreshCredits = useCreditStore((s) => s.refreshCredits);
  const [activeGenerationIds, setActiveGenerationIds] = useState<string[]>([]);
  const [model, setModel] = useState<string>(tierConfig.model);
  const [imageCount, setImageCount] = useState(() => {
    if (typeof window === "undefined") return tierConfig.imageCount;
    const saved = localStorage.getItem(`${IMAGE_COUNT_KEY_PREFIX}:${projectId}`);
    return saved ? Number(saved) : tierConfig.imageCount;
  });
  const [activeTab, setActiveTab] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [pendingSlotCounts, setPendingSlotCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    localStorage.setItem(`${IMAGE_COUNT_KEY_PREFIX}:${projectId}`, String(imageCount));
  }, [imageCount, projectId]);

  useEffect(() => {
    if (!isModelAvailable(model, tier)) {
      const available = AI_MODELS.filter((m) => isModelAvailable(m.value, tier));
      if (available.length > 0) setModel(available[available.length - 1].value);
    }
  }, [tier]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingGenerations = projectGenerations.filter(
    (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING || g.status === GENERATION_STATUS.RETRYING
  );
  const allActiveIds = useMemo(
    () => [
      ...new Set([
        ...pendingGenerations.map((g) => g.id),
        ...activeGenerationIds,
      ]),
    ],
    [pendingGenerations, activeGenerationIds]
  );
  const activeGenerations = useMemo(() => {
    const fromProject = projectGenerations.filter(
      (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING || g.status === GENERATION_STATUS.RETRYING
    );
    const projectIds = new Set(fromProject.map((g) => g.id));
    const localOnly = activeGenerationIds
      .filter((id) => !projectIds.has(id))
      .map((id) => ({ id, status: GENERATION_STATUS.QUEUED, createdAt: new Date(), images: [] as never[] }));
    return [...fromProject, ...localOnly];
  }, [projectGenerations, activeGenerationIds]);
  const hasActiveGeneration = allActiveIds.length > 0;

  useEffect(() => {
    setActiveGenerationIds((prev) =>
      prev.filter(
        (id) =>
          !projectGenerations.some(
            (g) =>
              g.id === id &&
              (g.status === GENERATION_STATUS.COMPLETED || g.status === GENERATION_STATUS.FAILED)
          )
      )
    );
  }, [projectGenerations]);

  async function handleRegenerate() {
    try {
      const data = await createGeneration({
        projectId,
        imageCount,
        model,
        attributeSnapshot: attributes,
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setPendingSlotCounts(prev => new Map(prev).set(data.generationId, imageCount));
      setPanelOpen(true);
      refreshCredits();
      toast.success("Regeneration queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  }

  async function handleGenerateMore(gen: Generation, count: number) {
    try {
      const data = await extendGeneration(gen.id, { imageCount: count });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setPendingSlotCounts(prev => new Map(prev).set(data.generationId, count));
      setPanelOpen(true);
      refreshCredits();
      toast.success("Generating more images...");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    }
  }

  async function handleGenerateSimilar(prompt: string) {
    if (!selectedImageId) return;
    const shouldIncludeLayers = inpaintRef.current.includeLayers;
    const flattenedImageDataUrl = shouldIncludeLayers ? await inpaintRef.current.flattenCanvasToDataUrl() : undefined;
    const snapshot: AttributeSelection = { ...attributes };
    if (prompt) snapshot[REF_PROMPT_KEY] = prompt;
    const data = await createGeneration({
      projectId,
      imageCount,
      model,
      referenceImageId: selectedImageId,
      flattenedImageDataUrl,
      attributeSnapshot: snapshot,
      textLayerSnapshot: shouldIncludeLayers
        ? canvasNodes.filter(n => n.visible !== false).map((n) => ({
            name: n.name ?? n.id,
            text: n.type === NODE_TYPE.TEXT ? (n.text ?? "") : "",
            type: n.type,
          }))
        : undefined,
    });
    setActiveGenerationIds((prev) => [...prev, data.generationId]);
    setPendingSlotCounts(prev => new Map(prev).set(data.generationId, imageCount));
    setPanelOpen(true);
    refreshCredits();
    toast.success("Reference generation queued!");
    router.refresh();
  }

  const handleGenerationComplete = useCallback(
    (generationId: string) => {
      setActiveGenerationIds((prev) => prev.filter((id) => id !== generationId));
      setPendingSlotCounts(prev => {
        const next = new Map(prev);
        next.delete(generationId);
        return next;
      });
    },
    []
  );

  return {
    activeGenerationIds, setActiveGenerationIds,
    model, setModel,
    imageCount, setImageCount,
    activeTab, setActiveTab,
    panelOpen, setPanelOpen,
    pendingSlotCounts, setPendingSlotCounts,
    handleRegenerate,
    handleGenerateSimilar,
    handleGenerateMore,
    handleGenerationComplete,
    allActiveIds,
    activeGenerations,
    hasActiveGeneration,
  };
}
