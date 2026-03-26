import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import remarkGfm from "remark-gfm";
import { getHelpDoc, getHelpDocs } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx-components";

interface HelpDocPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getHelpDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: HelpDocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getHelpDoc(slug);
  if (!doc) return {};

  return {
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    alternates: {
      canonical: `/help/${slug}`,
    },
  };
}

export default async function HelpDocPage({ params }: HelpDocPageProps) {
  const { slug } = await params;
  const doc = getHelpDoc(slug);
  if (!doc) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link
        href="/help"
        className="mb-8 inline-block text-sm text-muted-foreground hover:underline"
      >
        &larr; Back to Help
      </Link>
      <article>
        <h1 className="mb-8 text-3xl font-bold">{doc.frontmatter.title}</h1>
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXRemote
            source={doc.content}
            components={mdxComponents}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
          />
        </div>
      </article>
    </main>
  );
}
