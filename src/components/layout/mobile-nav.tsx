"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, BookOpen, Coins, MessageSquarePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCreditStore } from "@/lib/stores/credit-store";
import { FeedbackDialog } from "@/components/feedback-dialog";

interface MobileNavProps {
  isAuthenticated: boolean;
}

export function MobileNav({ isAuthenticated }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const creditBalance = useCreditStore((s) => s.balance);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-muted md:hidden">
        <Menu className="size-5" />
        <span className="sr-only">Menu</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            BookClad
          </SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-3">
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                My Covers
              </Link>
              <Link
                href="/settings?tab=billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Coins className="size-4 text-yellow-500" />
                <span className="tabular-nums">{creditBalance}</span>
                <span className="text-muted-foreground">credits</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setFeedbackOpen(true);
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-left"
              >
                <MessageSquarePlus className="size-4 text-primary" />
                Send Feedback
              </button>
              <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
