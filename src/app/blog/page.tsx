import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Tips, guides, and insights for self-published authors designing book covers for Amazon KDP.",
};

export default function BlogIndex() {
  const posts = getBlogPosts();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Blog</h1>
      <p className="mb-8 text-muted-foreground">
        Tips and guides for self-published authors.
      </p>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">
          No posts yet. Check back soon!
        </p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block space-y-1"
              >
                <h2 className="text-xl font-semibold group-hover:underline">
                  {post.frontmatter.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(post.frontmatter.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-muted-foreground">
                  {post.frontmatter.description}
                </p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
