"use client";

import { useState } from "react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { SUBSCRIPTION_STATUS } from "@/lib/constants";

interface GeneralTabProps {
  showPrompt: boolean;
  onShowPromptChange: (checked: boolean) => void;
  subscriptionStatus: string | null;
}

export function GeneralTab({
  showPrompt,
  onShowPromptChange,
  subscriptionStatus,
}: GeneralTabProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="show-prompt" className="text-sm font-medium">
            Show system prompt in generation history
          </Label>
          <p className="text-xs text-muted-foreground">
            Show the full AI system prompt alongside the user prompt. When off,
            system prompts can still be expanded per-generation.
          </p>
        </div>
        <Switch
          id="show-prompt"
          checked={showPrompt}
          onCheckedChange={onShowPromptChange}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Privacy</Label>
          <p className="text-xs text-muted-foreground">
            Read about how we handle your data.
          </p>
        </div>
        <Link
          href="/privacy"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Privacy Policy
        </Link>
      </div>

      <div className="rounded-lg border border-destructive/30 p-4">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This cannot be
          undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Account
        </Button>
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        hasActiveSubscription={subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE}
      />
    </div>
  );
}
