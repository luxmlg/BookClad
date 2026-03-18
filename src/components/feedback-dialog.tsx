"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageCircle, X, Upload, ChevronDown, Loader2, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_AREAS,
  CATEGORY_LABELS,
  CATEGORY_PLACEHOLDERS,
  AREA_LABELS,
  captureFeedbackContext,
} from "@/lib/feedback";
import type { FeedbackCategory, FeedbackArea, FeedbackContext } from "@/lib/feedback";
import { uploadFeedbackImage, submitFeedback } from "@/lib/api/feedback";

const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const CATEGORY_ICONS: Record<FeedbackCategory, typeof Bug> = {
  bug: Bug,
  feature: Lightbulb,
  general: MessageCircle,
};

const CATEGORY_ICON_COLORS: Record<FeedbackCategory, string> = {
  bug: "text-red-500",
  feature: "text-yellow-500",
  general: "text-sky-400",
};

interface Attachment {
  url: string;
  preview: string;
  name: string;
}

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState<FeedbackArea | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const contextRef = useRef<FeedbackContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capture context when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        contextRef.current = captureFeedbackContext();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const resetForm = useCallback(() => {
    setCategory("bug");
    setTitle("");
    setDescription("");
    setArea(undefined);
    setAttachments([]);
    setContextOpen(false);
    contextRef.current = null;
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const remaining = MAX_ATTACHMENTS - attachments.length;
      const toUpload = files.slice(0, remaining);

      for (const file of toUpload) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 5MB limit`);
          continue;
        }
        if (!file.type.match(/^image\/(png|jpeg|gif)$/)) {
          toast.error(`${file.name}: only PNG, JPG, and GIF are allowed`);
          continue;
        }

        setUploading(true);
        try {
          const url = await uploadFeedbackImage(file);
          const preview = URL.createObjectURL(file);
          setAttachments((prev) => [...prev, { url, preview, name: file.name }]);
        } catch (err) {
          toast.error(`Failed to upload ${file.name}`);
          console.error("Upload error:", err);
        } finally {
          setUploading(false);
        }
      }

      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [attachments.length]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;

    const context = contextRef.current ?? captureFeedbackContext();

    setSubmitting(true);
    try {
      const result = await submitFeedback({
        category,
        title: title.trim(),
        description: description.trim(),
        area,
        attachmentUrls: attachments.map((a) => a.url),
        context,
      });

      toast.success("Feedback submitted!", {
        description: `Issue #${result.issueNumber} created`,
        action: {
          label: "View on GitHub",
          onClick: () => window.open(result.issueUrl, "_blank"),
        },
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit feedback";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    category,
    title,
    description,
    area,
    attachments,
    resetForm,
    onOpenChange,
  ]);

  const context = contextRef.current;
  const canSubmit =
    title.trim().length >= 5 &&
    description.trim().length >= 10 &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve BookClad. Your feedback creates a tracked issue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Category */}
          <div className="flex flex-col gap-2">
            <Label>Category</Label>
            <div className="flex gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("size-3.5", CATEGORY_ICON_COLORS[cat])} />
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="feedback-title">Title</Label>
              {title.length > 0 && title.trim().length < 5 && (
                <span className="text-xs text-muted-foreground">
                  {5 - title.trim().length} more character{5 - title.trim().length !== 1 ? "s" : ""} needed
                </span>
              )}
            </div>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="feedback-description">Description</Label>
              {description.length > 0 && description.trim().length < 10 && (
                <span className="text-xs text-muted-foreground">
                  {10 - description.trim().length} more character{10 - description.trim().length !== 1 ? "s" : ""} needed
                </span>
              )}
            </div>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={CATEGORY_PLACEHOLDERS[category]}
              maxLength={5000}
              className="min-h-24"
            />
          </div>

          {/* Area */}
          <div className="flex flex-col gap-2">
            <Label>Related Area (optional)</Label>
            <Select value={area ?? ""} onValueChange={(v) => setArea(v as FeedbackArea)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {area ? AREA_LABELS[area] : "Select area..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {AREA_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          <div className="flex flex-col gap-2">
            <Label>Attachments (optional)</Label>
            {attachments.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {attachments.map((att, i) => (
                  <div
                    key={att.url}
                    className="group relative size-16 rounded-md border overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length < MAX_ATTACHMENTS && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {uploading ? "Uploading..." : "Add image"}
                </Button>
                <span className="ml-2 text-xs text-muted-foreground">
                  PNG, JPG, GIF up to 5MB ({MAX_ATTACHMENTS - attachments.length} remaining)
                </span>
              </div>
            )}
          </div>

          {/* Context preview */}
          {context && (
            <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    contextOpen && "rotate-180"
                  )}
                />
                Context that will be included
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <span className="font-medium">Page:</span>
                    <span>{context.url}</span>
                    {context.projectId && (
                      <>
                        <span className="font-medium">Project:</span>
                        <span>{context.projectId}</span>
                      </>
                    )}
                    <span className="font-medium">Screen:</span>
                    <span>{context.screenResolution}</span>
                    <span className="font-medium">Browser:</span>
                    <span className="truncate">{context.userAgent}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <ExternalLink className="size-3.5" />
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
