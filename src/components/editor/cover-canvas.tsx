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
import { KDP } from "@/lib/constants";

const CANVAS_SCALE_DIVISOR = 4;
export const CANVAS_WIDTH = KDP.width / CANVAS_SCALE_DIVISOR;   // 400
export const CANVAS_HEIGHT = KDP.height / CANVAS_SCALE_DIVISOR; // 640
export const SCALE = 1 / CANVAS_SCALE_DIVISOR;

// ── Node Types ──────────────────────────────────────────

export interface TextNodeConfig {
  type: "text";
  id: string;
  name?: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: "left" | "center" | "right";
  fontStyle: string;
  width: number;
  visible: boolean;
  draggable: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  autoWidth?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textTransform?: "none" | "uppercase" | "lowercase";
}

export interface ImageNodeConfig {
  type: "image";
  id: string;
  name?: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible: boolean;
  draggable: boolean;
  opacity?: number;
}

export type CanvasNode = TextNodeConfig | ImageNodeConfig;

export interface CanvasState {
  nodes: CanvasNode[];
}

export function parseCanvasState(raw: unknown): CanvasState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.nodes)) return { nodes: obj.nodes as CanvasNode[] };
  return null;
}

// ── Snap Guide ──────────────────────────────────────────

interface Guide {
  x?: number;
  y?: number;
  type?: "grid" | "element";
}

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

const SNAP_THRESHOLD = 5;
const GRID_LINES_X = [0, 0.25, 0.5, 0.75, 1].map((p) => p * CANVAS_WIDTH);
const GRID_LINES_Y = [0, 0.25, 0.5, 0.75, 1].map((p) => p * CANVAS_HEIGHT);

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
  onImageLoadRef.current = onImageLoad;

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

  useEffect(() => {
    if (!imageUrl) {
      setBgImage(null);
      return;
    }
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
    let changed = false;
    for (const config of nodes) {
      if (config.type !== "text" || config.autoWidth === false) continue;
      const node = nodeRefs.current[config.id];
      if (!node) continue;
      const w = node.width();
      if (measuredWidths[config.id] !== w) {
        updates[config.id] = w;
        changed = true;
      }
    }
    if (changed) setMeasuredWidths((prev) => ({ ...prev, ...updates }));
  });

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
    const newGuides: Guide[] = [];

    // Dragged node edges and center (account for offsetX/Y on auto-width text nodes)
    const ox = node.offsetX();
    const oy = node.offsetY();
    const nodeLeft = node.x() - ox;
    const nodeRight = node.x() - ox + node.width();
    const nodeCenterX = node.x() - ox + node.width() / 2;
    const nodeTop = node.y() - oy;
    const nodeBottom = node.y() - oy + node.height();
    const nodeCenterY = node.y() - oy + node.height() / 2;

    // Collect snap targets per axis
    const xTargets: { pos: number; type: "grid" | "element" }[] =
      GRID_LINES_X.map((pos) => ({ pos, type: "grid" }));
    const yTargets: { pos: number; type: "grid" | "element" }[] =
      GRID_LINES_Y.map((pos) => ({ pos, type: "grid" }));

    // Add other visible elements' edges and centers
    for (const config of nodes) {
      if (config.id === node.id() || !config.visible) continue;
      const ref = nodeRefs.current[config.id];
      if (!ref) continue;
      const rox = ref.offsetX();
      const roy = ref.offsetY();
      xTargets.push(
        { pos: ref.x() - rox, type: "element" },
        { pos: ref.x() - rox + ref.width() / 2, type: "element" },
        { pos: ref.x() - rox + ref.width(), type: "element" },
      );
      yTargets.push(
        { pos: ref.y() - roy, type: "element" },
        { pos: ref.y() - roy + ref.height() / 2, type: "element" },
        { pos: ref.y() - roy + ref.height(), type: "element" },
      );
    }

    // Find best X snap
    let bestDx: number | null = null;
    let bestSnapX: number | null = null;
    let bestAbsDx = SNAP_THRESHOLD;
    let bestTypeX: "grid" | "element" = "grid";
    for (const target of xTargets) {
      for (const edge of [nodeLeft, nodeCenterX, nodeRight]) {
        const dx = target.pos - edge;
        if (Math.abs(dx) < bestAbsDx) {
          bestAbsDx = Math.abs(dx);
          bestDx = dx;
          bestSnapX = target.pos;
          bestTypeX = target.type;
        }
      }
    }
    if (bestDx !== null && bestSnapX !== null) {
      node.x(node.x() + bestDx);
      newGuides.push({ x: bestSnapX, type: bestTypeX });
    }

    // Find best Y snap
    let bestDy: number | null = null;
    let bestSnapY: number | null = null;
    let bestAbsDy = SNAP_THRESHOLD;
    let bestTypeY: "grid" | "element" = "grid";
    for (const target of yTargets) {
      for (const edge of [nodeTop, nodeCenterY, nodeBottom]) {
        const dy = target.pos - edge;
        if (Math.abs(dy) < bestAbsDy) {
          bestAbsDy = Math.abs(dy);
          bestDy = dy;
          bestSnapY = target.pos;
          bestTypeY = target.type;
        }
      }
    }
    if (bestDy !== null && bestSnapY !== null) {
      node.y(node.y() + bestDy);
      newGuides.push({ y: bestSnapY, type: bestTypeY });
    }

    setGuides(newGuides);
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

export function getDefaultCanvasState(
  title: string,
  author: string,
): CanvasState {
  return {
    nodes: [
      {
        type: "text",
        id: "title",
        name: "Title",
        text: title,
        x: 800,
        y: 200,
        fontSize: 96,
        fontFamily: "Playfair Display",
        fill: "#ffffff",
        align: "center",
        fontStyle: "bold",
        width: 1280,
        visible: true,
        draggable: true,
        autoWidth: true,
      },
      {
        type: "text",
        id: "author",
        name: "Author",
        text: author,
        x: 800,
        y: 2200,
        fontSize: 56,
        fontFamily: "Montserrat",
        fill: "rgba(255,255,255,0.9)",
        align: "center",
        fontStyle: "normal",
        width: 1280,
        visible: true,
        draggable: true,
        autoWidth: true,
      },
    ],
  };
}
