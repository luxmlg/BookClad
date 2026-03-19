"use client";

import { useState, useRef } from "react";
import type { Generation } from "./types";
import { PANEL_MAX_HEIGHT } from "./types";
import { GenerationGroup } from "./generation-group";

interface GenerationHistoryProps {
  generations: Generation[];
  imageUrls: Record<string, string>;
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  showPrompt: boolean;
  draftImageIds: Set<string>;
  onDiscardDrafts: () => void;
  onGenerateMore: (generation: Generation, imageCount: number) => Promise<void>;
  activeIds: Set<string>;
  pendingSlotCounts: Map<string, number>;
  unseenImageIds: Set<string>;
}

export function GenerationHistory({
  generations,
  imageUrls,
  selectedImageId,
  onSelect,
  showPrompt,
  draftImageIds,
  onDiscardDrafts,
  onGenerateMore,
  activeIds,
  pendingSlotCounts,
  unseenImageIds,
}: GenerationHistoryProps) {
  const expandSeqRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandRequest, setExpandRequest] = useState<{
    imageId: string;
    seq: number;
  } | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {}
  );

  const handleExpandImage = (imageId: string) => {
    setExpandRequest({ imageId, seq: ++expandSeqRef.current });
  };

  const handleNameChange = (genId: string, name: string) => {
    setNameOverrides((prev) => ({ ...prev, [genId]: name }));
  };

  const getDisplayName = (gen: Generation) => {
    if (gen.id in nameOverrides) return nameOverrides[gen.id];
    return gen.name ?? "";
  };

  if (generations.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No generations yet
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-auto px-4 pb-3"
      style={{ maxHeight: PANEL_MAX_HEIGHT }}
    >
      <div className="space-y-1">
        {generations.map((gen, idx) => (
          <GenerationGroup
            key={gen.id}
            generation={gen}
            index={generations.length - idx}
            imageUrls={imageUrls}
            selectedImageId={selectedImageId}
            onSelect={onSelect}
            onExpandImage={handleExpandImage}
            expandRequest={expandRequest}
            defaultOpen={idx === 0 || activeIds.has(gen.id)}
            allGenerations={generations}
            onNameChange={handleNameChange}
            getDisplayName={getDisplayName}
            scrollContainerRef={scrollContainerRef}
            showPrompt={showPrompt}
            draftImageIds={draftImageIds}
            onDiscardDrafts={onDiscardDrafts}
            onGenerateMore={onGenerateMore}
            activeIds={activeIds}
            pendingSlotCounts={pendingSlotCounts}
            unseenImageIds={unseenImageIds}
          />
        ))}
      </div>
    </div>
  );
}
