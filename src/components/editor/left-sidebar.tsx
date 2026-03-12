"use client";

import {
  Save,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRES, MOODS, ART_STYLES, AI_MODELS } from "@/lib/constants";

interface LeftSidebarProps {
  genre: string;
  setGenre: (v: string) => void;
  moods: string[];
  toggleMood: (m: string) => void;
  style: string;
  setStyle: (v: string) => void;
  brief: string;
  setBrief: (v: string) => void;
  imageCount: number;
  setImageCount: (v: number) => void;
  model: string;
  setModel: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  onOpenSimilarDialog: () => void;
  selectedImageId: string | null;
  pendingGeneration: boolean;
}

export function LeftSidebar({
  genre,
  setGenre,
  moods,
  toggleMood,
  style,
  setStyle,
  brief,
  setBrief,
  imageCount,
  setImageCount,
  model,
  setModel,
  saving,
  onSave,
  onRegenerate,
  onOpenSimilarDialog,
  selectedImageId,
  pendingGeneration,
}: LeftSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">Book Details</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label>Genre</Label>
            <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select genre">
                  {GENRES.find((g) => g.value === genre)?.label ?? "Select genre"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mood</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <Badge
                  key={m}
                  variant={moods.includes(m) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleMood(m)}
                >
                  {m}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Art Style</Label>
            <Select value={style} onValueChange={(v) => v && setStyle(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select style">
                  {ART_STYLES.find((s) => s.value === style)?.label ?? "Select style"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ART_STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Brief / AI Prompt</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Describe visual elements, themes..."
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select model">
                  {AI_MODELS.find((m) => m.value === model)?.label ?? "Select model"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Used for generation, reference generation, and inpainting
            </p>
          </div>

          <div className="space-y-2">
            <Label>Images per generation: {imageCount}</Label>
            <Slider
              value={[imageCount]}
              onValueChange={(v) =>
                setImageCount(Array.isArray(v) ? v[0] : v)
              }
              min={1}
              max={8}
              step={1}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1</span>
              <span>8</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — sticky bottom */}
      <div className="space-y-2 border-t p-4">
        <Button
          className="w-full gap-2"
          onClick={onRegenerate}
          disabled={pendingGeneration}
        >
          {pendingGeneration ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Generate Covers
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onOpenSimilarDialog}
          disabled={!selectedImageId}
        >
          <Sparkles className="size-4" />
          Generate Similar
        </Button>
      </div>
    </div>
  );
}
