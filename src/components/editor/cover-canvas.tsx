"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text,
  Transformer,
  Line,
} from "react-konva";
import type Konva from "konva";
import type { TextNodeConfig, ImageNodeConfig, CanvasNode } from "./canvas-types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, SCALE } from "./canvas-types";
import { type Guide, computeSnapGuides, type ElementRect } from "@/lib/canvas";

// ── Hook: load asset images ─────────────────────────────

function useAssetImages(assetUrls: Record<string, string>) {
  const [loaded, setLoaded] = useState<Record<string, HTMLImageElement>>({});
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const [assetId, url] of Object.entries(assetUrls)) {
      if (loaded[assetId] || loadingRef.current.has(assetId)) continue;
      loadingRef.current.add(assetId);
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        setLoaded((prev) => ({ ...prev, [assetId]: img }));
        loadingRef.current.delete(assetId);
      };
      img.onerror = () => {
        loadingRef.current.delete(assetId);
      };
    }
  }, [assetUrls, loaded]);

  return loaded;
}

// ── Canvas Props ────────────────────────────────────────

interface CoverCanvasProps {
  imageUrl: string | undefined;
  nodes: CanvasNode[];
  assetUrls: Record<string, string>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodeDragEnd: (id: string, x: number, y: number) => void;
  onNodeTransformEnd: (id: string, attrs: Partial<CanvasNode>) => void;
  stageRef?: React.RefObject<Konva.Stage | null>;
  onImageLoad?: () => void;
  hideCursor?: boolean;
}

export function CoverCanvas({
  imageUrl,
  nodes,
  assetUrls,
  selectedNodeId,
  onSelectNode,
  onNodeDragEnd,
  onNodeTransformEnd,
  stageRef: externalStageRef,
  onImageLoad,
  hideCursor,
}: CoverCanvasProps) {
  const internalStageRef = useRef<Konva.Stage>(null);
  const stageRef = externalStageRef || internalStageRef;
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const transformerRef = useRef<Konva.Transformer>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [measuredWidths, setMeasuredWidths] = useState<Record<string, number>>({});
  const onImageLoadRef = useRef(onImageLoad);

  useEffect(() => {
    onImageLoadRef.current = onImageLoad;
  }, [onImageLoad]);

  // When hideCursor is true, set pointer-events:none on Konva's inner <canvas>
  // elements so Chrome's compositor can't source a cursor from them.
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;
    const canvases = container.querySelectorAll("canvas");
    canvases.forEach((c) => {
      c.style.pointerEvents = hideCursor ? "none" : "";
    });
  }, [hideCursor, stageRef]);

  const assetImages = useAssetImages(assetUrls);

  // Determine selected node type for transformer config
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const isImageSelected = selectedNode?.type === "image";

  // Render-time state adjustment: clear background when imageUrl is removed
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    if (!imageUrl) {
      setBgImage(null);
    }
  }

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      setBgImage(img);
      onImageLoadRef.current?.();
    };
    return () => { cancelled = true; };
  }, [imageUrl]);

  // Measure auto-width text nodes after render for offsetX calculation
  useEffect(() => {
    const updates: Record<string, number> = {};
    for (const config of nodes) {
      if (config.type !== "text" || config.autoWidth === false) continue;
      const node = nodeRefs.current[config.id];
      if (!node) continue;
      updates[config.id] = node.width();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- updates state from DOM measurements (Konva node widths)
    setMeasuredWidths((prev) => {
      let changed = false;
      for (const [id, w] of Object.entries(updates)) {
        if (prev[id] !== w) { changed = true; break; }
      }
      return changed ? { ...prev, ...updates } : prev;
    });
  }, [nodes]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const node = selectedNodeId ? nodeRefs.current[selectedNodeId] : null;
    if (node) {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedNodeId]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage()) {
        onSelectNode(null);
      }
    },
    [onSelectNode],
  );

  function handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target;
    const ox = node.offsetX();
    const oy = node.offsetY();

    const otherElements: ElementRect[] = [];
    for (const config of nodes) {
      if (config.id === node.id() || !config.visible) continue;
      const ref = nodeRefs.current[config.id];
      if (!ref) continue;
      otherElements.push({
        x: ref.x(), y: ref.y(),
        width: ref.width(), height: ref.height(),
        offsetX: ref.offsetX(), offsetY: ref.offsetY(),
      });
    }

    const result = computeSnapGuides(
      {
        left: node.x() - ox,
        right: node.x() - ox + node.width(),
        centerX: node.x() - ox + node.width() / 2,
        top: node.y() - oy,
        bottom: node.y() - oy + node.height(),
        centerY: node.y() - oy + node.height() / 2,
      },
      otherElements,
    );

    if (result.dx !== null) node.x(node.x() + result.dx);
    if (result.dy !== null) node.y(node.y() + result.dy);
    setGuides(result.guides);
  }

  function handleDragEnd(id: string, e: Konva.KonvaEventObject<DragEvent>) {
    setGuides([]);
    onNodeDragEnd(id, e.target.x(), e.target.y());
  }

  function handleTextTransformEnd(id: string) {
    const node = nodeRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    // Convert from offset-origin to left-origin when switching to fixed width
    const offsetX = node.offsetX();
    const adjustedX = node.x() - offsetX;
    node.offsetX(0);

    onNodeTransformEnd(id, {
      x: adjustedX,
      y: node.y(),
      width: Math.max(20, node.width() * scaleX),
      rotation: node.rotation(),
      autoWidth: false,
    } as Partial<TextNodeConfig>);
  }

  function handleImageTransformEnd(id: string) {
    const node = nodeRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    onNodeTransformEnd(id, {
      x: node.x(),
      y: node.y(),
      width: node.width() * scaleX,
      height: node.height() * scaleY,
      rotation: node.rotation(),
    } as Partial<ImageNodeConfig>);
  }

  function applyTextTransform(text: string, transform?: string): string {
    if (transform === "uppercase") return text.toUpperCase();
    if (transform === "lowercase") return text.toLowerCase();
    return text;
  }

  function renderTextNode(config: TextNodeConfig) {
    if (!config.visible) return null;
    const isAutoWidth = config.autoWidth !== false;
    const mw = measuredWidths[config.id] ?? 0;
    const offsetX = isAutoWidth
      ? config.align === "center"
        ? mw / 2
        : config.align === "right"
          ? mw
          : 0
      : 0;
    return (
      <Text
        key={config.id}
        ref={(ref) => {
          nodeRefs.current[config.id] = ref;
        }}
        id={config.id}
        text={applyTextTransform(config.text, config.textTransform)}
        x={config.x * SCALE}
        y={config.y * SCALE}
        fontSize={config.fontSize * SCALE}
        fontFamily={config.fontFamily}
        fill={config.fill}
        align={config.align}
        fontStyle={config.fontStyle}
        letterSpacing={(config.letterSpacing ?? 0) * SCALE}
        lineHeight={config.lineHeight ?? 1}
        textDecoration={config.textDecoration ?? ""}
        width={isAutoWidth ? undefined : config.width * SCALE}
        offsetX={offsetX}
        draggable={config.draggable}
        rotation={config.rotation ?? 0}
        shadowColor={config.shadowColor}
        shadowBlur={(config.shadowBlur ?? 0) * SCALE}
        shadowOffsetX={(config.shadowOffsetX ?? 2) * SCALE}
        shadowOffsetY={(config.shadowOffsetY ?? 2) * SCALE}
        shadowOpacity={config.shadowOpacity ?? 0.7}
        stroke={config.stroke || ""}
        strokeWidth={(config.strokeWidth ?? 0) * SCALE}
        onClick={() => onSelectNode(config.id)}
        onTap={() => onSelectNode(config.id)}
        onDragMove={handleDragMove}
        onDragEnd={(e) => handleDragEnd(config.id, e)}
        onTransformEnd={() => handleTextTransformEnd(config.id)}
      />
    );
  }

  function renderImageNode(config: ImageNodeConfig) {
    if (!config.visible) return null;
    const img = assetImages[config.assetId];
    if (!img) return null;
    return (
      <KonvaImage
        key={config.id}
        ref={(ref) => {
          nodeRefs.current[config.id] = ref;
        }}
        id={config.id}
        image={img}
        x={config.x * SCALE}
        y={config.y * SCALE}
        width={config.width * SCALE}
        height={config.height * SCALE}
        rotation={config.rotation ?? 0}
        opacity={config.opacity ?? 1}
        draggable={config.draggable}
        onClick={() => onSelectNode(config.id)}
        onTap={() => onSelectNode(config.id)}
        onDragMove={handleDragMove}
        onDragEnd={(e) => handleDragEnd(config.id, e)}
        onTransformEnd={() => handleImageTransformEnd(config.id)}
      />
    );
  }

  function renderNode(node: CanvasNode) {
    return node.type === "image" ? renderImageNode(node) : renderTextNode(node);
  }

  return (
    <Stage
      ref={stageRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={handleStageClick}
      onTap={handleStageClick}
      style={{ cursor: hideCursor ? "none" : "default" }}
    >
      <Layer>
        {bgImage && (
          <KonvaImage
            image={bgImage}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
          />
        )}
      </Layer>
      <Layer>
        {nodes.map(renderNode)}
        <Transformer
          ref={transformerRef}
          enabledAnchors={
            isImageSelected
              ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]
              : ["middle-left", "middle-right"]
          }
          keepRatio={isImageSelected}
          rotateEnabled={true}
          rotateAnchorOffset={20}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
            return newBox;
          }}
        />
      </Layer>
      {/* Snap guide layer */}
      <Layer listening={false}>
        {guides.map((g, i) => {
          const color = g.type === "element" ? "#ff00ff" : "#00bfff";
          return g.x !== undefined ? (
            <Line
              key={`gx-${i}`}
              points={[g.x, 0, g.x, CANVAS_HEIGHT]}
              stroke={color}
              strokeWidth={1}
              dash={[4, 4]}
            />
          ) : g.y !== undefined ? (
            <Line
              key={`gy-${i}`}
              points={[0, g.y, CANVAS_WIDTH, g.y]}
              stroke={color}
              strokeWidth={1}
              dash={[4, 4]}
            />
          ) : null;
        })}
      </Layer>
    </Stage>
  );
}

