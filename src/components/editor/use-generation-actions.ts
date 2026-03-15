"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TextNodeConfig } from "./canvas-types";
import { GENERATION_STATUS, IMAGE_COUNT_KEY_PREFIX } from "@/lib/constants";
import type { AttributeSelection } from "@/lib/attributes";
import { createGeneration } from "@/lib/api";
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
  handleRegenerate: () => Promise<void>;
  handleGenerateSimilar: () => Promise<void>;
  handleGenerationComplete: (generationId: string) => void;
  allActiveIds: string[];
  activeGenerations: Generation[];
  hasActiveGeneration: boolean;
  refDialogOpen: boolean;
  setRefDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  refPrompt: string;
  setRefPrompt: React.Dispatch<React.SetStateAction<string>>;
  refSubmitting: boolean;
}

export function useGenerationActions(
  projectId: string,
  projectGenerations: Generation[],
  attributes: AttributeSelection,
  textNodes: TextNodeConfig[],
  selectedImageId: string | null,
  inpaintRef: React.RefObject<Pick<UseInpaintStateResult, "includeLayers" | "flattenCanvasToDataUrl">>,
  router: ReturnType<typeof useRouter>,
): UseGenerationActionsResult {
  const [activeGenerationIds, setActiveGenerationIds] = useState<string[]>([]);
  const [model, setModel] = useState("openai");
  const [imageCount, setImageCount] = useState(() => {
    if (typeof window === "undefined") return 4;
    const saved = localStorage.getItem(`${IMAGE_COUNT_KEY_PREFIX}:${projectId}`);
    return saved ? Number(saved) : 4;
  });
  const [activeTab, setActiveTab] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [refPrompt, setRefPrompt] = useState("");
  const [refSubmitting, setRefSubmitting] = useState(false);

  useEffect(() => {
    localStorage.setItem(`${IMAGE_COUNT_KEY_PREFIX}:${projectId}`, String(imageCount));
  }, [imageCount, projectId]);

  const pendingGenerations = projectGenerations.filter(
    (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING
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
      (g) => g.status === GENERATION_STATUS.QUEUED || g.status === GENERATION_STATUS.PROCESSING
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
        textLayerSnapshot: textNodes.map((n) => ({
          name: n.name ?? n.id,
          text: n.text ?? "",
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setActiveTab(1);
      setPanelOpen(true);
      toast.success("Regeneration queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate");
    }
  }

  async function handleGenerateSimilar() {
    if (!selectedImageId) return;
    setRefSubmitting(true);
    try {
      const flattenedImageDataUrl = inpaintRef.current.includeLayers ? await inpaintRef.current.flattenCanvasToDataUrl() : undefined;
      const data = await createGeneration({
        projectId,
        imageCount,
        model,
        referenceImageId: selectedImageId,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: textNodes.map((n) => ({
          name: n.name ?? n.id,
          text: n.text ?? "",
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setActiveTab(1);
      setPanelOpen(true);
      toast.success("Reference generation queued!");
      setRefDialogOpen(false);
      setRefPrompt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRefSubmitting(false);
    }
  }

  const handleGenerationComplete = useCallback(
    (generationId: string) => {
      setActiveGenerationIds((prev) => {
        const next = prev.filter((id) => id !== generationId);
        if (next.length === 0) setActiveTab(0);
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
    handleRegenerate,
    handleGenerateSimilar,
    handleGenerationComplete,
    allActiveIds,
    activeGenerations,
    hasActiveGeneration,
    refDialogOpen, setRefDialogOpen,
    refPrompt, setRefPrompt,
    refSubmitting,
  };
}
