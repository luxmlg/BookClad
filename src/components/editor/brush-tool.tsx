"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Line, Rect } from "react-konva";
import type Konva from "konva";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Eraser, Paintbrush, RotateCcw, Undo2, X } from "lucide-react";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 640;

interface BrushLine {
  points: number[];
  strokeWidth: number;
  erasing: boolean;
}

interface BrushToolProps {
  onExportMask: (dataUrl: string) => void;
  onCancel: () => void;
}

export function BrushTool({ onExportMask, onCancel }: BrushToolProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const maskLayerRef = useRef<Konva.Layer>(null);
  const [lines, setLines] = useState<BrushLine[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [erasing, setErasing] = useState(false);

  // Undo: Ctrl+Z / Cmd+Z
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        setLines((prev) => prev.slice(0, -1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      setIsDrawing(true);
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      setLines((prev) => [
        ...prev,
        { points: [pos.x, pos.y], strokeWidth: brushSize, erasing },
      ]);
    },
    [brushSize, erasing]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isDrawing) return;
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      setLines((prev) => {
        const updated = [...prev];
        const last = { ...updated[updated.length - 1] };
        last.points = [...last.points, pos.x, pos.y];
        updated[updated.length - 1] = last;
        return updated;
      });
    },
    [isDrawing]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  function handleUndo() {
    setLines((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setLines([]);
  }

  function handleExport() {
    const layer = maskLayerRef.current;
    if (!layer) return;

    // Temporarily show the hidden mask layer for export
    layer.visible(true);
    layer.getLayer()?.batchDraw();
    const dataUrl = layer.toDataURL({
      pixelRatio: 1600 / CANVAS_WIDTH,
    });
    layer.visible(false);
    layer.getLayer()?.batchDraw();

    onExportMask(dataUrl);
  }

  const hasMask = lines.some((l) => !l.erasing);
  const brushCursor = erasing
    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize}' height='${brushSize}'%3E%3Ccircle cx='${brushSize / 2}' cy='${brushSize / 2}' r='${brushSize / 2 - 1}' fill='none' stroke='%23aaa' stroke-width='2' stroke-dasharray='4'/%3E%3C/svg%3E") ${brushSize / 2} ${brushSize / 2}, crosshair`
    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${brushSize}' height='${brushSize}'%3E%3Ccircle cx='${brushSize / 2}' cy='${brushSize / 2}' r='${brushSize / 2 - 1}' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${brushSize / 2} ${brushSize / 2}, crosshair`;

  return (
    <div className="relative" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <Stage
        ref={stageRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{ cursor: brushCursor }}
      >
        {/*
          Overlay layer (visible): dims the image, brush strokes cut holes to
          "reveal" the original cover underneath — shows the user exactly which
          regions are selected for editing.
        */}
        <Layer>
          <Rect
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill="rgba(0,0,0,0.45)"
          />
          {lines.map((line, i) =>
            line.erasing ? (
              // Eraser: re-paint the dim overlay to "un-reveal"
              <Line
                key={i}
                points={line.points}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation="source-over"
              />
            ) : (
              // Paint: cut a hole in the overlay to reveal the image
              <Line
                key={i}
                points={line.points}
                stroke="white"
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation="destination-out"
              />
            )
          )}
        </Layer>

        {/*
          Mask layer (hidden): black = keep, white = edit.
          Only made visible during toDataURL() export.
        */}
        <Layer ref={maskLayerRef} visible={false}>
          <Rect
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill="black"
          />
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.erasing ? "black" : "white"}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation="source-over"
            />
          ))}
        </Layer>
      </Stage>

      {/* Floating toolbar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded-lg bg-background/90 p-2 shadow-lg backdrop-blur-sm border">
        <Button
          variant={!erasing ? "default" : "outline"}
          size="icon-sm"
          onClick={() => setErasing(false)}
          title="Paint (select region)"
        >
          <Paintbrush className="size-3" />
        </Button>
        <Button
          variant={erasing ? "default" : "outline"}
          size="icon-sm"
          onClick={() => setErasing(true)}
          title="Erase (deselect region)"
        >
          <Eraser className="size-3" />
        </Button>
        <Slider
          value={[brushSize]}
          onValueChange={(v) => setBrushSize(Array.isArray(v) ? v[0] : v)}
          min={5}
          max={80}
          step={1}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-6 text-right">{brushSize}</span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleUndo}
          disabled={lines.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-3" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleClear}
          disabled={lines.length === 0}
          title="Clear all"
        >
          <RotateCcw className="size-3" />
        </Button>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!hasMask}
        >
          Done
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          title="Cancel"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}
