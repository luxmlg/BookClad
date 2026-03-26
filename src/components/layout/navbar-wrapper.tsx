"use client";

import { usePathname } from "next/navigation";

const HIDDEN_ROUTES = ["/sign-in"];

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (HIDDEN_ROUTES.includes(pathname)) return null;
  return <>{children}</>;
}
