import { Skeleton } from "@/components/ui/skeleton";

export default function EditorLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex flex-1 items-center justify-center bg-muted/20 p-8">
        <Skeleton
          className="rounded-xl"
          style={{ aspectRatio: "1600/2560", height: "min(78vh, 600px)" }}
        />
      </div>
      <div className="w-80 border-l bg-background p-4 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
