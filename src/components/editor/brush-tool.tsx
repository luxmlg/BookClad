"use client";

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { Stage, Layer, Line, Rect } from "react-konva";
import type Konva from "konva";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 640;

interface BrushLine {
  points: number[];
  strokeWidth: number;
  erasing: boolean;
}

export interface BrushToolHandle {
  undo: () => void;
  clear: () => void;
  export: () => void;
  hasMask: boolean;
}

interface BrushToolProps {
  onExportMask: (dataUrl: string) => void;
  brushSize: number;
  erasing: boolean;
  onHasMaskChange?: (hasMask: boolean) => void;
}

export const BrushTool = forwardRef<BrushToolHandle, BrushToolProps>(
  function BrushTool({ onExportMask, brushSize, erasing, onHasMaskChange }, ref) {
    const stageRef = useRef<Konva.Stage>(null);
    const maskLayerRef = useRef<Konva.Layer>(null);
    const [lines, setLines] = useState<BrushLine[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);

    const hasMask = lines.some((l) => !l.erasing);

    useEffect(() => {
      onHasMaskChange?.(hasMask);
    }, [hasMask, onHasMaskChange]);

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

    useImperativeHandle(ref, () => ({
      undo() {
        setLines((prev) => prev.slice(0, -1));
      },
      clear() {
        setLines([]);
      },
      export() {
        const layer = maskLayerRef.current;
        if (!layer) return;
        layer.visible(true);
        layer.getLayer()?.batchDraw();
        const dataUrl = layer.toDataURL({
          pixelRatio: 1600 / CANVAS_WIDTH,
        });
        layer.visible(false);
        layer.getLayer()?.batchDraw();
        onExportMask(dataUrl);
      },
      get hasMask() {
        return hasMask;
      },
    }), [hasMask, onExportMask]);

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
      </div>
    );
  }
);
