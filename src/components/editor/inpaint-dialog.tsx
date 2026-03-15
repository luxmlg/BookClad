"use client";

import Image from "next/image";
import { Loader2, Paintbrush, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InpaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedImageUrl: string | null | undefined;
  includeLayers: boolean;
  layerPreviewUrl: string | null | undefined;
  inpaintMask: string | null;
  inpaintPrompt: string;
  setInpaintPrompt: (prompt: string) => void;
  onIncludeLayersChange: (checked: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
  onRepaint: () => void;
  onCancel: () => void;
}

export function InpaintDialog({
  open,
  onOpenChange,
  selectedImageUrl,
  includeLayers,
  layerPreviewUrl,
  inpaintMask,
  inpaintPrompt,
  setInpaintPrompt,
  onIncludeLayersChange,
  submitting,
  onSubmit,
  onRepaint,
  onCancel,
}: InpaintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Region</DialogTitle>
          <DialogDescription>
            Describe what should replace the painted region. The AI will
            regenerate only the selected area.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {selectedImageUrl && (
            <div className="flex justify-center">
              <div
                className="relative overflow-hidden rounded-lg border"
                style={{ width: 120, aspectRatio: "1600/2560" }}
              >
                {includeLayers && layerPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layerPreviewUrl}
                    alt="With layers"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={selectedImageUrl}
                    alt="Selected cover"
                    width={120}
                    height={192}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                )}
                {inpaintMask && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inpaintMask}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-50"
                  />
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Describe the replacement</Label>
            <Textarea
              value={inpaintPrompt}
              onChange={(e) => setInpaintPrompt(e.target.value)}
              placeholder="e.g. Replace with a starry night sky, add a golden border..."
              rows={3}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="include-layers-inpaint">Include canvas layers</Label>
            <Switch id="include-layers-inpaint" checked={includeLayers} onCheckedChange={onIncludeLayersChange} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onRepaint}
            className="gap-1.5"
          >
            <Paintbrush className="size-4" />
            Re-paint
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !inpaintPrompt.trim()}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
