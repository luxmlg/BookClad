"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, MessageSquarePlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackDialog } from "@/components/feedback-dialog";

interface UserMenuProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  signOutAction: () => Promise<void>;
}

export function UserMenu({ name, email, image, signOutAction }: UserMenuProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={image ?? undefined} alt={name ?? ""} />
            <AvatarFallback>
              {name?.charAt(0)?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
            <div className="flex w-full items-center gap-2">
              <MessageSquarePlus className="size-3.5" />
              Send Feedback
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link href="/settings" className="flex w-full items-center gap-2">
              <Settings className="size-3.5" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 text-left"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
