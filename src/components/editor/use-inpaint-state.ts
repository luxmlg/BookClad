"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type Konva from "konva";
import type { CanvasNode } from "./canvas-types";
import { CANVAS_WIDTH, NODE_TYPE } from "./canvas-types";
import { KDP } from "@/lib/constants";
import type { AttributeSelection } from "@/lib/attributes";
import { createInpaint } from "@/lib/api";
import { useCreditStore } from "@/lib/stores/credit-store";

export interface UseInpaintStateResult {
  brushMode: boolean;
  setBrushMode: React.Dispatch<React.SetStateAction<boolean>>;
  inpaintMask: string | null;
  setInpaintMask: React.Dispatch<React.SetStateAction<string | null>>;
  inpaintSubmitting: boolean;
  includeLayers: boolean;
  brushSize: number;
  setBrushSize: React.Dispatch<React.SetStateAction<number>>;
  erasing: boolean;
  setErasing: React.Dispatch<React.SetStateAction<boolean>>;
  hasBrushMask: boolean;
  setHasBrushMask: React.Dispatch<React.SetStateAction<boolean>>;
  brushToolRef: React.RefObject<import("./brush-tool").BrushToolHandle | null>;
  handleInpaintSubmit: (prompt: string) => Promise<void>;
  handleBakeSubmit: (prompt: string, imageCount: number) => Promise<void>;
  bakeSubmitting: boolean;
  handleIncludeLayersChange: (checked: boolean) => void;
  flattenCanvasToDataUrl: () => Promise<string | undefined>;
}

export function useInpaintState(
  stageRef: React.RefObject<Konva.Stage | null>,
  selectedImageId: string | null,
  setSelectedNodeId: (id: string | null) => void,
  setActiveGenerationIds: React.Dispatch<React.SetStateAction<string[]>>,
  setPanelOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setActiveTab: React.Dispatch<React.SetStateAction<number>>,
  setPendingSlotCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>,
  model: string,
  attributes: AttributeSelection,
  canvasNodes: CanvasNode[],
  router: ReturnType<typeof useRouter>,
): UseInpaintStateResult {
  const [brushMode, setBrushMode] = useState(false);
  const [inpaintMask, setInpaintMask] = useState<string | null>(null);
  const [inpaintSubmitting, setInpaintSubmitting] = useState(false);
  const [includeLayers, setIncludeLayers] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [erasing, setErasing] = useState(false);
  const [hasBrushMask, setHasBrushMask] = useState(false);
  const [bakeSubmitting, setBakeSubmitting] = useState(false);
  const brushToolRef = useRef<import("./brush-tool").BrushToolHandle>(null);
  const refreshCredits = useCreditStore((s) => s.refreshCredits);

  async function flattenCanvasToDataUrl(): Promise<string | undefined> {
    const stage = stageRef.current;
    if (!stage) return undefined;
    setSelectedNodeId(null);
    await new Promise((r) => setTimeout(r, 50));
    await document.fonts.ready;
    const layers = stage.getLayers();
    const hiddenLayers: Konva.Layer[] = [];
    for (let i = 2; i < layers.length; i++) {
      if (layers[i].visible()) {
        layers[i].visible(false);
        hiddenLayers.push(layers[i]);
      }
    }
    const dataUrl = stage.toDataURL({
      pixelRatio: KDP.width / CANVAS_WIDTH,
      mimeType: "image/jpeg",
      quality: 0.9,
    });
    for (const layer of hiddenLayers) {
      layer.visible(true);
    }
    return dataUrl;
  }

  function handleIncludeLayersChange(checked: boolean) {
    setIncludeLayers(checked);
  }

  async function handleInpaintSubmit(prompt: string) {
    if (!selectedImageId || !inpaintMask || !prompt.trim()) {
      toast.error("Please paint a region and enter a prompt");
      return;
    }
    setInpaintSubmitting(true);
    try {
      const flattenedImageDataUrl = includeLayers ? await flattenCanvasToDataUrl() : undefined;
      const data = await createInpaint({
        imageId: selectedImageId,
        maskDataUrl: inpaintMask,
        prompt,
        model,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: includeLayers
          ? canvasNodes.filter(n => n.visible !== false).map((n) => ({
              name: n.name ?? n.id,
              text: n.type === NODE_TYPE.TEXT ? (n.text ?? "") : "",
              type: n.type,
            }))
          : undefined,
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setPendingSlotCounts(prev => new Map(prev).set(data.generationId, 1));
      setPanelOpen(true);
      setActiveTab(0);
      toast.success("Inpainting job queued!");
      setBrushMode(false);
      setInpaintMask(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inpaint failed");
    } finally {
      setInpaintSubmitting(false);
    }
  }

  async function handleBakeSubmit(prompt: string, imageCount: number): Promise<void> {
    if (!selectedImageId) {
      toast.error("Please select an image first");
      return;
    }
    setBakeSubmitting(true);
    try {
      const flattenedImageDataUrl = await flattenCanvasToDataUrl();
      const data = await createInpaint({
        imageId: selectedImageId,
        prompt,
        model,
        imageCount,
        flattenedImageDataUrl,
        attributeSnapshot: attributes,
        textLayerSnapshot: canvasNodes.filter(n => n.visible !== false).map((n) => ({
          name: n.name ?? n.id,
          text: n.type === NODE_TYPE.TEXT ? (n.text ?? "") : "",
          type: n.type,
        })),
      });
      setActiveGenerationIds((prev) => [...prev, data.generationId]);
      setPendingSlotCounts(prev => new Map(prev).set(data.generationId, imageCount));
      setPanelOpen(true);
      setActiveTab(0);
      refreshCredits();
      toast.success("Bake layers queued!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bake failed");
    } finally {
      setBakeSubmitting(false);
    }
  }

  return {
    brushMode, setBrushMode,
    inpaintMask, setInpaintMask,
    inpaintSubmitting,
    includeLayers,
    brushSize, setBrushSize,
    erasing, setErasing,
    hasBrushMask, setHasBrushMask,
    brushToolRef,
    handleInpaintSubmit,
    handleBakeSubmit,
    bakeSubmitting,
    handleIncludeLayersChange,
    flattenCanvasToDataUrl,
  };
}
