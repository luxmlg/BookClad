"use client";

import Image from "next/image";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

interface GenerateSimilarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedImageUrl: string | null | undefined;
  includeLayers: boolean;
  layerPreviewUrl: string | null | undefined;
  imageCount: number;
  setImageCount: (count: number) => void;
  onIncludeLayersChange: (checked: boolean) => void;
  refPrompt: string;
  setRefPrompt: (prompt: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

export function GenerateSimilarDialog({
  open,
  onOpenChange,
  selectedImageUrl,
  includeLayers,
  layerPreviewUrl,
  imageCount,
  setImageCount,
  onIncludeLayersChange,
  refPrompt,
  setRefPrompt,
  submitting,
  onSubmit,
}: GenerateSimilarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Similar Covers</DialogTitle>
          <DialogDescription>
            Create new covers inspired by the selected image. Optionally add a
            prompt to guide the variation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {selectedImageUrl && (
            <div className="flex justify-center">
              <div
                className="overflow-hidden rounded-lg border"
                style={{ width: 120, aspectRatio: "1600/2560" }}
              >
                {includeLayers && layerPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={layerPreviewUrl}
                    alt="Reference with layers"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={selectedImageUrl}
                    alt="Reference"
                    width={120}
                    height={192}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                )}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Additional instructions (optional)</Label>
            <Textarea
              value={refPrompt}
              onChange={(e) => setRefPrompt(e.target.value)}
              placeholder="e.g. Make it more dramatic, change the color palette to warm tones..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Number of variations: {imageCount}</Label>
            <Slider
              value={[imageCount]}
              onValueChange={(v) =>
                setImageCount(Array.isArray(v) ? v[0] : v)
              }
              min={1}
              max={8}
              step={1}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="include-layers-ref">Include canvas layers</Label>
            <Switch id="include-layers-ref" checked={includeLayers} onCheckedChange={onIncludeLayersChange} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
