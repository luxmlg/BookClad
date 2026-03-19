"use client";

import { useState, useCallback } from "react";

export interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  activeGenerationId: string | null;
  toggle: (imageId: string, generationId: string) => void;
  clear: () => void;
  isSelected: (imageId: string) => boolean;
  count: number;
}

export function useMultiSelect(): UseMultiSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);

  const toggle = useCallback((imageId: string, generationId: string) => {
    setSelectedIds((prev) => {
      // Different generation — start fresh
      if (activeGenerationId !== null && generationId !== activeGenerationId) {
        setActiveGenerationId(generationId);
        return new Set([imageId]);
      }

      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }

      if (next.size === 0) {
        setActiveGenerationId(null);
      } else {
        setActiveGenerationId(generationId);
      }

      return next;
    });
  }, [activeGenerationId]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setActiveGenerationId(null);
  }, []);

  const isSelected = useCallback(
    (imageId: string) => selectedIds.has(imageId),
    [selectedIds],
  );

  return {
    selectedIds,
    activeGenerationId,
    toggle,
    clear,
    isSelected,
    count: selectedIds.size,
  };
}
