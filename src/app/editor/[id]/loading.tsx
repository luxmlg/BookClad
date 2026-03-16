import {
  Save,
  RefreshCw,
  Sparkles,
  BookmarkIcon,
  ChevronRight,
  Plus,
  Download,
  Paintbrush,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function EditorLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Sidebar */}
      <div className="hidden w-72 flex-col border-r bg-background lg:flex">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Book Details</h2>
          <Button variant="ghost" size="icon-sm" disabled>
            <Save className="size-3.5" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Style Preset */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Style Preset</span>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>

          {/* Attributes (4) */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}

          {/* Brief / AI Prompt */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Brief / AI Prompt</span>
            <Skeleton className="h-[88px] w-full rounded-md" />
          </div>

          <Separator />

          {/* AI Model */}
          <div className="space-y-2">
            <span className="text-sm font-medium">AI Model</span>
            <Skeleton className="h-9 w-full rounded-md" />
            <p className="text-xs text-muted-foreground">
              Used for generation, reference generation, and inpainting
            </p>
          </div>

          {/* Images per generation */}
          <div className="space-y-2">
            <span className="text-sm font-medium">
              Images per generation:{" "}
              <Skeleton className="inline-block h-3.5 w-4 align-middle rounded" />
            </span>
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>8</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t p-4">
          <Button className="w-full gap-2" disabled>
            <RefreshCw className="size-4" />
            Generate Covers
          </Button>
          <Button variant="outline" className="w-full gap-2" disabled>
            <Sparkles className="size-4" />
            Generate Similar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto flex gap-1.5"
            disabled
          >
            <BookmarkIcon className="size-3.5" />
            Save as Preset
          </Button>
        </div>
      </div>

      {/* Center */}
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
        {/* Canvas area */}
        <div className="relative flex flex-1 items-center justify-center gap-3 p-4">
          {/* Main canvas */}
          <Skeleton
            className="shrink-0 rounded-xl"
            style={{ width: 400, height: 640 }}
          />

          {/* Kindle preview */}
          <div
            className="flex w-[75px] shrink-0 flex-col items-center justify-end"
            style={{ height: 640 }}
          >
            <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Kindle ~120px
            </p>
            <Skeleton
              className="w-[75px] rounded-lg"
              style={{ aspectRatio: "1600/2560" }}
            />
          </div>
        </div>

        {/* Generation History */}
        <div className="shrink-0 border-t bg-background/80">
          <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground">
            <ChevronRight className="size-3.5" />
            <span>Generation History</span>
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden w-72 flex-col border-l bg-background lg:flex">
        {/* Header */}
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Properties</h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Layers section */}
          <div className="px-2">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">
              Layers
            </span>
            <div className="mt-1 divide-y rounded-md border">
              {/* Background image layer */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-5 w-7 rounded" />
                <Skeleton className="h-4 flex-1" />
              </div>
              {/* Text layer */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-5 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-4" />
              </div>
            </div>
            <div className="py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled
              >
                <Plus className="size-3.5" />
                Add Text
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Typography section */}
          <div className="p-4">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">
              Typography
            </span>
            <p className="py-4 text-center text-sm text-muted-foreground">
              Select a layer to edit
            </p>
          </div>

          <Separator />

          {/* Magic Edit section */}
          <div className="p-4">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">
              Magic Edit
            </span>
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Paint over an area of the selected image you want to change,
                then describe the replacement.
              </p>
              <Button variant="outline" className="mt-3 w-full gap-2" disabled>
                <Paintbrush className="size-4" />
                Edit Region
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t p-4">
          <Button className="w-full gap-2" disabled>
            <Download className="size-4" />
            Export JPEG (KDP-Ready)
          </Button>
          <Button variant="outline" className="w-full gap-2" disabled>
            <Download className="size-4" />
            Export PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
