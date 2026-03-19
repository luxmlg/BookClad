"use client";

import { useState, useRef, useCallback } from "react";
import { Trash2, RefreshCw, Coins, Images } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { JOB_TYPE } from "@/lib/constants";

type PendingAction = { type: "delete" | "regenerate"; imageIds: string[] };

interface ImageContextMenuProps {
  children: React.ReactNode;
  generationJobType: string;
  perImageCost: number;
  multiSelectIds: Set<string>;
  onMultiSelectClear: () => void;
  onDeleteImages: (imageIds: string[]) => void;
  onRegenerateImages: (imageIds: string[]) => void;
}

export function ImageContextMenu({
  children,
  generationJobType,
  perImageCost,
  multiSelectIds,
  onMultiSelectClear,
  onDeleteImages,
  onRegenerateImages,
}: ImageContextMenuProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const rightClickedIdRef = useRef<string | null>(null);

  const canRegenerate = generationJobType === JOB_TYPE.GENERATE;

  const getEffectiveIds = useCallback((): string[] => {
    const clickedId = rightClickedIdRef.current;
    if (clickedId && multiSelectIds.has(clickedId)) {
      return [...multiSelectIds];
    }
    return clickedId ? [clickedId] : [];
  }, [multiSelectIds]);

  const effectiveCount = (() => {
    const clickedId = rightClickedIdRef.current;
    if (clickedId && multiSelectIds.has(clickedId)) return multiSelectIds.size;
    return 1;
  })();

  function handleFilter(target: HTMLElement): boolean {
    const el = target.closest("[data-image-id]") as HTMLElement | null;
    if (!el) return false;
    const imageId = el.getAttribute("data-image-id");
    if (!imageId) return false;
    rightClickedIdRef.current = imageId;

    if (!multiSelectIds.has(imageId)) {
      onMultiSelectClear();
    }
    return true;
  }

  function handleDelete() {
    const ids = getEffectiveIds();
    if (ids.length > 0) setPendingAction({ type: "delete", imageIds: ids });
  }

  function handleRegenerate() {
    const ids = getEffectiveIds();
    if (ids.length > 0) setPendingAction({ type: "regenerate", imageIds: ids });
  }

  function confirmAction() {
    if (!pendingAction) return;
    if (pendingAction.type === "delete") {
      onDeleteImages(pendingAction.imageIds);
    } else {
      onRegenerateImages(pendingAction.imageIds);
    }
    setPendingAction(null);
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger filter={handleFilter}>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {canRegenerate && (
            <>
              <ContextMenuItem onClick={handleRegenerate}>
                <RefreshCw className="size-4" />
                Regenerate {effectiveCount > 1 && <><span className="font-medium">{effectiveCount}</span> <Images className="size-3.5 text-muted-foreground" /></>}
                <span className="ml-auto flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Coins className="size-3 text-yellow-500" />
                  {effectiveCount * perImageCost}
                </span>
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem variant="destructive" onClick={handleDelete}>
            <Trash2 className="size-4" />
            Delete {effectiveCount > 1 && <><span className="font-medium">{effectiveCount}</span> <Images className="size-3.5 text-muted-foreground" /></>}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete"
                ? pendingAction.imageIds.length > 1
                  ? `Delete ${pendingAction.imageIds.length} images?`
                  : "Delete image?"
                : pendingAction?.imageIds && pendingAction.imageIds.length > 1
                  ? `Regenerate ${pendingAction.imageIds.length} images?`
                  : "Regenerate image?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? "This action cannot be undone. The images will be permanently deleted."
                : "The selected images will be deleted and new ones generated in their place. This will use credits."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.type === "delete" ? "destructive" : "default"}
              onClick={confirmAction}
            >
              {pendingAction?.type === "delete" ? "Delete" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
