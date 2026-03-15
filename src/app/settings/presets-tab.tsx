"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AttributeSelection } from "@/lib/attributes";

export interface StylePreset {
  id: string;
  name: string;
  attributes: AttributeSelection;
  promptTemplate: string | null;
}

interface PresetsTabProps {
  presets: StylePreset[];
  onDelete: (id: string) => void;
}

export function PresetsTab({ presets, onDelete }: PresetsTabProps) {
  if (presets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-medium">No presets yet</p>
          <p className="mt-1 text-sm">
            Save a style preset from the editor sidebar to reuse attribute
            combinations across projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {presets.map((preset) => (
        <Card key={preset.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{preset.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(
                  preset.attributes as Record<string, string | string[]>
                ).map(([key, val]) => {
                  const display = Array.isArray(val)
                    ? val.join(", ")
                    : (val as string);
                  if (!display) return null;
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {display}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(preset.id)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
