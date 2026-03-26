import type { Metadata } from "next";
import Link from "next/link";
import { getHelpDocsByCategory } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Help & Docs",
  description:
    "Learn how to use BookClad to create AI-generated book covers for Amazon KDP.",
};

export default function HelpIndex() {
  const categories = getHelpDocsByCategory();
  const categoryNames = Object.keys(categories);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Help & Docs</h1>
      <p className="mb-8 text-muted-foreground">
        Everything you need to know about using BookClad.
      </p>

      {categoryNames.length === 0 ? (
        <p className="text-muted-foreground">
          Documentation is coming soon. Check back later!
        </p>
      ) : (
        <div className="space-y-10">
          {categoryNames.map((category) => (
            <section key={category}>
              <h2 className="mb-4 text-xl font-semibold">{category}</h2>
              <div className="space-y-3">
                {categories[category].map((doc) => (
                  <Link
                    key={doc.slug}
                    href={`/help/${doc.slug}`}
                    className="group block rounded-lg border p-4 hover:bg-muted/50"
                  >
                    <h3 className="font-medium group-hover:underline">
                      {doc.frontmatter.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {doc.frontmatter.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
