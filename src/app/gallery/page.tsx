import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cover Gallery",
  description:
    "Book covers created with BookClad — AI-generated designs for Amazon KDP.",
};

export default function GalleryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Cover Gallery</h1>
      <p className="text-muted-foreground">
        A showcase of covers created with BookClad. Coming soon!
      </p>
    </main>
  );
}
