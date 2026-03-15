"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface GeneralTabProps {
  showPrompt: boolean;
  onShowPromptChange: (checked: boolean) => void;
}

export function GeneralTab({ showPrompt, onShowPromptChange }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="show-prompt" className="text-sm font-medium">
            Show system prompt in generation history
          </Label>
          <p className="text-xs text-muted-foreground">
            Show the full AI system prompt alongside the user prompt. When off, system prompts can still be expanded per-generation.
          </p>
        </div>
        <Switch
          id="show-prompt"
          checked={showPrompt}
          onCheckedChange={onShowPromptChange}
        />
      </div>
    </div>
  );
}
