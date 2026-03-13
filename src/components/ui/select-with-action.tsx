import type React from "react";
import { Button } from "@/components/ui/button";

interface SelectWithActionProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  title?: string;
}

export function SelectWithAction({
  children,
  icon,
  onClick,
  title,
}: SelectWithActionProps) {
  return (
    <div className="flex gap-1.5">
      <div className="flex-1 min-w-0">{children}</div>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={onClick}
        title={title}
      >
        {icon}
      </Button>
    </div>
  );
}
