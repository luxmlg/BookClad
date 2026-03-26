import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content");

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  tags: string[];
  image?: string;
}

export interface HelpFrontmatter {
  title: string;
  description: string;
  category: string;
  order: number;
}

export interface ContentEntry<T> {
  slug: string;
  frontmatter: T;
  content: string;
}

function getContentEntries<T>(subdir: string): ContentEntry<T>[] {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.mdx$/, ""),
        frontmatter: data as T,
        content,
      };
    });
}

export function getBlogPosts(): ContentEntry<BlogFrontmatter>[] {
  return getContentEntries<BlogFrontmatter>("blog").sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
  );
}

export function getBlogPost(
  slug: string
): ContentEntry<BlogFrontmatter> | undefined {
  return getBlogPosts().find((post) => post.slug === slug);
}

export function getHelpDocs(): ContentEntry<HelpFrontmatter>[] {
  return getContentEntries<HelpFrontmatter>("help").sort(
    (a, b) => a.frontmatter.order - b.frontmatter.order
  );
}

export function getHelpDoc(
  slug: string
): ContentEntry<HelpFrontmatter> | undefined {
  return getHelpDocs().find((doc) => doc.slug === slug);
}

export function getHelpDocsByCategory(): Record<
  string,
  ContentEntry<HelpFrontmatter>[]
> {
  const docs = getHelpDocs();
  const grouped: Record<string, ContentEntry<HelpFrontmatter>[]> = {};
  for (const doc of docs) {
    const cat = doc.frontmatter.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
  }
  return grouped;
}
