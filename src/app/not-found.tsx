import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className={buttonVariants({ className: "gap-2" })}>
        <Home className="size-4" />
        Back to home
      </Link>
    </div>
  );
}
