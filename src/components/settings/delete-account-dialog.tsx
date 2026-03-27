"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasActiveSubscription: boolean;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  hasActiveSubscription,
}: DeleteAccountDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmation === "DELETE";

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Account deleted");
      await signOut({ redirectTo: "/" });
    } catch {
      toast.error("Failed to delete account");
      setDeleting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) setConfirmation("");
    onOpenChange(open);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription render={<div className="space-y-3" />}>
              <p>
                This will permanently delete your account and all associated
                data including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>All projects and generated images</li>
                <li>Uploaded fonts and assets</li>
                <li>Style presets and attribute settings</li>
                <li>Credit balance and transaction history</li>
              </ul>
              <p className="font-medium text-destructive">
                This action cannot be undone.
              </p>
              {hasActiveSubscription && (
                <p className="rounded-md bg-destructive/10 p-3 text-destructive">
                  You have an active subscription. We will attempt to cancel it,
                  but please verify in your DodoPayments account that it has been
                  cancelled.
                </p>
              )}
              <p>
                Type <strong className="text-foreground">DELETE</strong> to
                confirm:
              </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Type DELETE to confirm"
          disabled={deleting}
          autoComplete="off"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmed || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
