import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";
import { CreditPill } from "./credit-pill";
import { UserMenu } from "./user-menu";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-5 text-primary" />
          <span className="text-lg">BookClad</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-3 md:flex">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                My Covers
              </Link>
              <CreditPill />
              <ThemeToggle />
              <UserMenu
                name={session.user.name}
                email={session.user.email}
                image={session.user.image}
                signOutAction={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link
                href="/sign-in"
                className={buttonVariants({ size: "sm" })}
              >
                Get Started
              </Link>
              <ThemeToggle />
            </>
          )}
        </nav>

        {/* Mobile nav */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <MobileNav isAuthenticated={!!session?.user} />
        </div>
      </div>
    </header>
  );
}
