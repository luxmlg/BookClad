"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Generation } from "./types";
import { GenerationGroup } from "./generation-group";
import { useMultiSelect } from "./use-multi-select";
import { deleteImages } from "@/lib/api";

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
  onDeletedImages: (deletedIds: string[], removedGenerationIds: string[]) => void;
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
  onDeletedImages,
}: GenerationHistoryProps) {
  const router = useRouter();
  const expandSeqRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandRequest, setExpandRequest] = useState<{
    imageId: string;
    seq: number;
  } | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(
    {}
  );

  const multiSelect = useMultiSelect();

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

  async function handleDeleteImages(imageIds: string[], _generation: Generation) {
    try {
      const result = await deleteImages(imageIds);
      onDeletedImages(result.deleted, result.generationsRemoved);
      multiSelect.clear();
      router.refresh();
      toast.success(
        result.deleted.length === 1
          ? "Image deleted"
          : `${result.deleted.length} images deleted`,
      );
    } catch {
      toast.error("Failed to delete images");
    }
  }

  async function handleRegenerateImages(imageIds: string[], generation: Generation) {
    try {
      const count = imageIds.length;
      const result = await deleteImages(imageIds);
      onDeletedImages(result.deleted, result.generationsRemoved);
      multiSelect.clear();
      await onGenerateMore(generation, count);
      toast.success(
        count === 1
          ? "Regenerating image..."
          : `Regenerating ${count} images...`,
      );
    } catch {
      toast.error("Failed to regenerate images");
    }
  }

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
      className="px-4 pb-3"
    >
      <div className="space-y-1">
        {generations.map((gen, idx) => {
          const isActiveGeneration = multiSelect.activeGenerationId === gen.id;
          return (
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
              multiSelectIds={isActiveGeneration ? multiSelect.selectedIds : new Set<string>()}
              onMultiSelectToggle={(imageId) => multiSelect.toggle(imageId, gen.id)}
              onMultiSelectClear={multiSelect.clear}
              onDeleteImages={(ids) => handleDeleteImages(ids, gen)}
              onRegenerateImages={(ids) => handleRegenerateImages(ids, gen)}
            />
          );
        })}
      </div>
    </div>
  );
}
