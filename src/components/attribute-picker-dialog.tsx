"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attribute } from "@/lib/attributes";

const TYPE_LABELS: Record<Attribute["type"], string> = {
  single: "Single",
  multi: "Multi",
  text: "Text",
  toggle: "Toggle",
  scale: "Scale",
  color: "Color",
  palette: "Palette",
};

interface AttributePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableAttributes: Attribute[];
  onSelect: (attribute: Attribute) => void;
  onCreateNew: () => void;
}

export function AttributePickerDialog({
  open,
  onOpenChange,
  availableAttributes,
  onSelect,
  onCreateNew,
}: AttributePickerDialogProps) {
  const [search, setSearch] = useState("");

  const filtered = availableAttributes.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase()),
  );

  function handleSelect(attribute: Attribute) {
    onSelect(attribute);
    setSearch("");
    onOpenChange(false);
  }

  function handleCreateNew() {
    setSearch("");
    onOpenChange(false);
    onCreateNew();
  }

  function handleOpenChange(next: boolean) {
    if (!next) setSearch("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Attribute</DialogTitle>
          <DialogDescription>
            Pick an existing attribute or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attributes..."
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="-mx-4 max-h-64 overflow-y-auto px-4">
          {filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map((attr) => (
                <button
                  key={attr.id}
                  type="button"
                  className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                  onClick={() => handleSelect(attr)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{attr.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABELS[attr.type]}
                      </Badge>
                    </div>
                    {attr.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {attr.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search ? "No matching attributes" : "No attributes available"}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full gap-2 border-dashed"
          onClick={handleCreateNew}
        >
          <PlusIcon className="size-4" />
          Create New Attribute
        </Button>
      </DialogContent>
    </Dialog>
  );
}
