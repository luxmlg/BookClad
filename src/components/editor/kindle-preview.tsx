"use client";

import { Tablet, EyeOff } from "lucide-react";

interface KindlePreviewProps {
  show: boolean;
  onToggle: (show: boolean) => void;
  kindlePreview: string | null;
  selectedImageUrl: string | null | undefined;
  kindleCrossfadeSnapshot: string | null;
  bgLoaded: boolean;
  onCrossfadeEnd: () => void;
}

export function KindlePreview({
  show,
  onToggle,
  kindlePreview,
  selectedImageUrl,
  kindleCrossfadeSnapshot,
  bgLoaded,
  onCrossfadeEnd,
}: KindlePreviewProps) {
  if (show) {
    return (
      <div className="absolute left-full ml-3 bottom-0 flex w-[75px] flex-col items-center justify-end">
        <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Kindle ~120px
        </p>
        <button
          onClick={() => onToggle(false)}
          className="group relative overflow-hidden rounded-lg border bg-muted/50 shadow-sm"
          style={{ width: 75, aspectRatio: "1600/2560" }}
          title="Hide preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={kindlePreview ?? selectedImageUrl ?? undefined}
            alt="Kindle preview"
            className="h-full w-full object-cover transition-[filter] group-hover:blur-sm"
          />
          {kindleCrossfadeSnapshot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={kindleCrossfadeSnapshot}
              alt=""
              className={`absolute inset-0 z-10 h-full w-full object-cover transition-opacity duration-300 ease-in-out ${
                kindlePreview || (bgLoaded && selectedImageUrl)
                  ? "opacity-0"
                  : "opacity-100"
              }`}
              onTransitionEnd={() => {
                if (kindlePreview || (bgLoaded && selectedImageUrl)) {
                  onCrossfadeEnd();
                }
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <EyeOff className="size-5 text-white drop-shadow-md" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => onToggle(true)}
      className="absolute left-full ml-3 bottom-0 flex flex-col items-center justify-end gap-1 pb-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <Tablet className="size-3.5" />
      <span>Preview</span>
    </button>
  );
}
