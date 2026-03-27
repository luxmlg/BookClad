"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  GENRES,
  AI_FILL_CREDIT_COST,
  CREDIT_COST_PER_IMAGE,
  QUICK_CREATE_TIER_CONFIG,
  AI_FILL_PROMPT_MAX_LENGTH,
  MAX_IMAGES_PER_GENERATION,
} from "@/lib/constants";
import { quickCreate } from "@/lib/api";

interface QuickCreateFormProps {
  tier: string;
  creditBalance: number;
  onSwitchToAdvanced: () => void;
}

export function QuickCreateForm({
  tier,
  creditBalance,
  onSwitchToAdvanced,
}: QuickCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tierConfig =
    QUICK_CREATE_TIER_CONFIG[tier as keyof typeof QUICK_CREATE_TIER_CONFIG] ??
    QUICK_CREATE_TIER_CONFIG.FREE;
  const [imageCount, setImageCount] = useState(tierConfig.imageCount);
  const generationCost =
    imageCount * CREDIT_COST_PER_IMAGE[tierConfig.model];
  const totalCost = AI_FILL_CREDIT_COST + generationCost;
  const canAfford = creditBalance >= totalCost;
  const isValid =
    title.trim() && author.trim() && genre && description.trim();

  const selectedGenreLabel =
    GENRES.find((g) => g.value === genre)?.label ?? "Select genre...";

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!isValid || !canAfford || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { projectId } = await quickCreate({
        title: title.trim(),
        author: author.trim(),
        genre,
        description: description.trim(),
        imageCount,
      });
      router.push(`/editor/${projectId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Book Title</Label>
        <Input
          id="title"
          placeholder="e.g. The Midnight Protocol"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="author">Author Name</Label>
        <Input
          id="author"
          placeholder="e.g. Jane Smith"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="genre">Genre</Label>
        <Select
          value={genre}
          onValueChange={(v) => setGenre(v as string)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="genre" className="w-full">
            <SelectValue>
              {genre ? selectedGenreLabel : "Select genre..."}
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
        <div className="flex items-center justify-between">
          <Label>Number of Covers</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{imageCount}</span>
        </div>
        <Slider
          min={1}
          max={MAX_IMAGES_PER_GENERATION}
          step={1}
          value={[imageCount]}
          onValueChange={(v) => setImageCount(Array.isArray(v) ? v[0] : v)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Book Description</Label>
          <span className="text-xs text-muted-foreground">
            {description.length}/{AI_FILL_PROMPT_MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id="description"
          placeholder="Describe your book — the story, characters, tone, and any visual ideas for the cover..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={AI_FILL_PROMPT_MAX_LENGTH}
          rows={5}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          className="w-full"
          disabled={!isValid || !canAfford || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating your covers...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Covers
            </>
          )}
        </Button>

        {!canAfford && (
          <p className="text-center text-sm text-destructive">
            Insufficient credits. You need {totalCost} credits (you have{" "}
            {creditBalance}).
          </p>
        )}

        {canAfford && (
          <p className="text-center text-xs text-muted-foreground">
            Uses {totalCost} credits ({AI_FILL_CREDIT_COST} for AI Fill +{" "}
            {generationCost} for {imageCount} covers)
          </p>
        )}

        <p className="text-center text-sm">
          <button
            type="button"
            onClick={onSwitchToAdvanced}
            className="text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            disabled={isSubmitting}
          >
            or customize attributes manually &rarr;
          </button>
        </p>
      </div>
    </form>
  );
}
