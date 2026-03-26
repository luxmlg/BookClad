# SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive SEO to BookClad — technical foundation, content infrastructure (blog/help), GA4 analytics with cookie consent, terms of use, and brand assets.

**Architecture:** Next.js App Router metadata API for SEO tags, `next-mdx-remote` for blog/help MDX rendering, GA4 loaded conditionally via cookie consent stored in localStorage, JSON-LD injected as `<script>` tags in server components.

**Tech Stack:** Next.js 16 (App Router metadata), `next-mdx-remote`, `gray-matter` (frontmatter parsing), Google Analytics 4 (script tag), Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-03-26-seo-design.md`

**Note:** No test framework is configured in this project. Verification is via `npx tsc --noEmit` (type-check) and `npm run build` (production build). Visual verification for UI components via `npm run dev`.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/robots.ts` | Programmatic robots.txt — allow public, disallow auth/api routes |
| `src/app/sitemap.ts` | Dynamic sitemap — static routes + blog + help slugs |
| `src/app/terms/page.tsx` | Terms of use static page |
| `src/app/blog/page.tsx` | Blog index — lists all posts sorted by date |
| `src/app/blog/[slug]/page.tsx` | Individual blog post — MDX rendering + per-post metadata + JSON-LD |
| `src/app/help/page.tsx` | Help index — lists docs grouped by category |
| `src/app/help/[slug]/page.tsx` | Individual help doc — MDX rendering + per-doc metadata |
| `src/app/gallery/page.tsx` | Gallery stub page |
| `src/lib/mdx.ts` | Shared MDX utilities — frontmatter parsing, content reading for both blog and help |
| `src/components/cookie-consent.tsx` | Cookie consent banner — localStorage persistence, accept/decline |
| `src/components/google-analytics.tsx` | GA4 conditional script loader — only loads after consent |
| `src/components/mdx-components.tsx` | Shared MDX component map for rendering custom elements in blog/help |
| `content/blog/.gitkeep` | Blog content directory placeholder |
| `content/help/.gitkeep` | Help content directory placeholder |

### Modified Files

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Expand metadata (OG, Twitter, canonical, keywords, verification), render CookieConsent + GoogleAnalytics |
| `src/app/page.tsx` | Add JSON-LD structured data (Organization + WebApplication) |
| `src/app/privacy/page.tsx` | Add metadata description, analytics/cookies disclosure sections |
| `src/app/dashboard/page.tsx` | Add `robots: noindex` metadata export |
| `src/app/create/page.tsx` | Add `robots: noindex` metadata export |
| `src/app/editor/[id]/page.tsx` | Add `robots: noindex` metadata export |
| `src/app/settings/page.tsx` | Add `robots: noindex` metadata export |
| `src/app/(auth)/sign-in/page.tsx` | Add `robots: noindex` metadata export, add Terms link |
| `package.json` | Add `next-mdx-remote`, `gray-matter` dependencies |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `next-mdx-remote`, `gray-matter`, and `@tailwindcss/typography`**

```bash
npm install next-mdx-remote gray-matter @tailwindcss/typography
```

`next-mdx-remote` renders MDX content in server components. `gray-matter` parses YAML frontmatter from MDX files. `@tailwindcss/typography` provides the `prose` classes used in blog/help content rendering.

- [ ] **Step 2: Verify installation**

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add next-mdx-remote and gray-matter for MDX content"
```

---

## Task 2: Root Metadata Enhancement

Expand the root layout metadata with Open Graph, Twitter Cards, keywords, canonical URL, `metadataBase`, and Google Search Console verification.

**Files:**
- Modify: `src/app/layout.tsx:1-20` (metadata export)

- [ ] **Step 1: Update metadata export**

Replace the existing `metadata` export in `src/app/layout.tsx` with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://bookclad.com"),
  title: {
    default: "BookClad - AI Book Cover Generator",
    template: "%s | BookClad",
  },
  description:
    "Generate KDP-compliant Kindle ebook covers from natural language prompts. Genre-aware AI, typography, compliance checker — all in one flow.",
  keywords: [
    "AI book cover generator",
    "KDP cover maker",
    "Kindle cover design",
    "ebook cover creator",
    "Amazon KDP cover",
    "book cover design tool",
    "self-publishing cover generator",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bookclad.com",
    siteName: "BookClad",
    title: "BookClad - AI Book Cover Generator",
    description:
      "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BookClad - AI Book Cover Generator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BookClad - AI Book Cover Generator",
    description:
      "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://bookclad.com",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "seo: add OG, Twitter, canonical, keywords, and verification to root metadata"
```

---

## Task 3: robots.ts

Create programmatic robots.txt that allows public pages, blocks authenticated routes and API.

**Files:**
- Create: `src/app/robots.ts`

- [ ] **Step 1: Create robots.ts**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/create",
          "/editor",
          "/settings",
          "/sign-in",
          "/sign-up",
          "/api/",
        ],
      },
    ],
    sitemap: "https://bookclad.com/sitemap.xml",
  };
}
```

Note: includes `/sign-in` and `/sign-up` (from spec review feedback — auth pages should be blocked).

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "seo: add robots.ts — block auth/api routes, point to sitemap"
```

---

## Task 4: noindex on Authenticated Pages

Add `robots: noindex` metadata to all protected routes. Belt-and-suspenders alongside robots.txt.

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/create/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/editor/[id]/page.tsx`
- Modify: `src/app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Add metadata to each page**

Add this export to each file listed above (at the top, alongside any existing imports). If the file already has a `metadata` export, merge the `robots` field into it:

```ts
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

For files that already import `Metadata` from "next", just add the export. All five pages currently have no metadata export, so add a static export to each.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/create/page.tsx src/app/settings/page.tsx src/app/editor/\[id\]/page.tsx src/app/\(auth\)/sign-in/page.tsx
git commit -m "seo: add noindex to authenticated and auth pages"
```

---

## Task 5: JSON-LD Structured Data on Landing Page

Add Organization and WebApplication schema.org markup to the landing page.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add JSON-LD scripts**

At the top of the returned JSX in the `Home` component (inside the outermost fragment or div), add:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "BookClad",
      url: "https://bookclad.com",
      logo: "https://bookclad.com/icon.svg",
      description: "AI-powered ebook cover generator for Amazon KDP",
    }),
  }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "BookClad",
      url: "https://bookclad.com",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "35",
        priceCurrency: "USD",
      },
    }),
  }}
/>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "seo: add Organization and WebApplication JSON-LD to landing page"
```

---

## Task 6: Terms of Use Page

Create the terms of use page and add links to it from the footer and sign-in page.

**Files:**
- Create: `src/app/terms/page.tsx`
- Modify: `src/app/page.tsx` (footer links)
- Modify: `src/app/(auth)/sign-in/page.tsx` (add terms link)

- [ ] **Step 1: Create terms page**

Create `src/app/terms/page.tsx` as a static server component. Structure it identically to the privacy page — same heading style, same section layout, same Tailwind classes.

Content sections:
1. **Acceptance of Terms** — by using BookClad, you agree to these terms
2. **Service Description** — AI-powered book cover generation for Amazon KDP
3. **User Accounts** — one account per person, keep credentials secure, accurate info
4. **AI-Generated Content** — covers generated are yours to use; BookClad doesn't claim ownership; user responsible for ensuring content doesn't infringe trademarks or copyrights; BookClad may display user-generated covers in marketing/gallery with permission
5. **Credits and Billing** — credit-based system, purchases non-refundable, subscriptions renew automatically, cancellation stops renewal but doesn't refund current period
6. **Acceptable Use** — no illegal/harmful content, no trademark infringement, no reverse engineering, no automated scraping
7. **Limitation of Liability** — service provided "as is", not liable for indirect damages, total liability capped at amount paid in last 12 months
8. **Termination** — either party can terminate, user can delete account in settings, BookClad reserves right to suspend accounts violating terms
9. **Changes to Terms** — BookClad may update terms, continued use constitutes acceptance
10. **Contact** — email address for questions

Add metadata:
```ts
export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms and conditions for using BookClad, the AI-powered book cover generator.",
};
```

Include "Last updated: March 26, 2026" at the top, same as privacy page.

- [ ] **Step 2: Add Terms link to landing page footer**

In `src/app/page.tsx`, find the footer links section (the `div` with Privacy link) and add a Terms link:

```tsx
<Link href="/terms">Terms</Link>
```

Place it after the Privacy link.

- [ ] **Step 3: Add Terms link to sign-in page**

In `src/app/(auth)/sign-in/page.tsx`, find the Privacy Policy link at the bottom and add a Terms link next to it:

```tsx
<Link href="/terms">Terms of Use</Link>
```

- [ ] **Step 4: Type-check and build**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/terms/page.tsx src/app/page.tsx src/app/\(auth\)/sign-in/page.tsx
git commit -m "feat: add terms of use page with footer and sign-in links"
```

---

## Task 7: Privacy Policy Update

Add analytics and cookies disclosure to the existing privacy policy page.

**Files:**
- Modify: `src/app/privacy/page.tsx`

- [ ] **Step 1: Add metadata description**

Update the existing metadata export to include a description:

```ts
export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BookClad collects, uses, and protects your data. Learn about our analytics, cookies, and your privacy rights.",
};
```

- [ ] **Step 2: Update the "Last updated" date**

Change to "Last updated: March 26, 2026" (or current date).

- [ ] **Step 3: Expand the "Cookies & Local Storage" section**

Add details about GA4 cookies to the existing Cookies section:

- `_ga` — Google Analytics, identifies unique users, expires 2 years
- `_ga_<MEASUREMENT_ID>` — Google Analytics, maintains session state, expires 2 years
- `cookie-consent` (localStorage) — stores user's cookie preference ("accepted" or "declined"), no expiry

- [ ] **Step 4: Add "Analytics" subsection under "Third-Party Services"**

Add Google Analytics disclosure:
- What: Google Analytics 4 for understanding site usage
- Data collected: page views, device type, browser, referrer, approximate location (country/city level)
- Purpose: improving the service and understanding which content is helpful
- Opt-out: decline cookies via the consent banner, or use browser extensions like Google Analytics Opt-out
- Google's privacy policy link

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "docs: update privacy policy with GA4 analytics and cookie disclosure"
```

---

## Task 8: Cookie Consent Banner

Create the cookie consent banner that gates GA4 loading.

**Files:**
- Create: `src/components/cookie-consent.tsx`

- [ ] **Step 1: Create cookie consent component**

Create `src/components/cookie-consent.tsx` — a client component (`"use client"`):

```tsx
"use client";

import { useState, useEffect } from "react";

const CONSENT_KEY = "cookie-consent";

type ConsentStatus = "accepted" | "declined" | null;

function getConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CONSENT_KEY) as ConsentStatus;
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentStatus>(null);

  useEffect(() => {
    setConsent(getConsent());
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
  };

  return { consent, accept, decline };
}

export function CookieConsent() {
  const { consent, accept, decline } = useCookieConsent();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render during SSR or if consent already given
  if (!mounted || consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies to understand how you use our site and improve your
          experience.{" "}
          <a href="/privacy" className="underline hover:text-foreground">
            Learn more
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={decline}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

Export `useCookieConsent` so the GA4 component can check consent status.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cookie-consent.tsx
git commit -m "feat: add cookie consent banner with localStorage persistence"
```

---

## Task 9: Google Analytics Component

Create the GA4 script loader that only activates after cookie consent.

**Files:**
- Create: `src/components/google-analytics.tsx`

- [ ] **Step 1: Create GA4 component**

Create `src/components/google-analytics.tsx` — a client component:

```tsx
"use client";

import Script from "next/script";
import { useCookieConsent } from "./cookie-consent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const { consent } = useCookieConsent();

  if (!GA_MEASUREMENT_ID || consent !== "accepted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: 'granted',
          });
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
```

When `NEXT_PUBLIC_GA_MEASUREMENT_ID` is unset (local dev), the component renders nothing.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/google-analytics.tsx
git commit -m "feat: add GA4 script loader — conditional on cookie consent"
```

---

## Task 10: Wire Consent + Analytics into Root Layout

Render both components in the root layout.

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Import and render components**

Add imports:
```ts
import { CookieConsent } from "@/components/cookie-consent";
import { GoogleAnalytics } from "@/components/google-analytics";
```

Render both inside the `<body>` tag, after the existing content but before the closing `</body>`:

```tsx
<CookieConsent />
<GoogleAnalytics />
```

They are client components and will hydrate on the client. The consent banner shows only once (until user decides). GA4 only loads after consent.

- [ ] **Step 2: Verify dev server**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Cookie consent banner appears at the bottom
- Clicking "Decline" hides the banner, doesn't reload
- Refreshing the page — banner stays hidden
- Clear localStorage and refresh — banner reappears
- GA4 script should NOT be in the DOM (no measurement ID in dev)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire cookie consent and GA4 into root layout"
```

---

## Task 11: MDX Utilities

Create shared utilities for reading and parsing MDX content files. Used by both blog and help routes.

**Files:**
- Create: `src/lib/mdx.ts`
- Create: `src/components/mdx-components.tsx`
- Create: `content/blog/.gitkeep`
- Create: `content/help/.gitkeep`

- [ ] **Step 1: Create content directories**

```bash
mkdir -p content/blog content/help
touch content/blog/.gitkeep content/help/.gitkeep
```

- [ ] **Step 2: Create MDX utility module**

Create `src/lib/mdx.ts`:

```ts
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
```

- [ ] **Step 3: Create MDX components map**

Create `src/components/mdx-components.tsx`:

```tsx
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import Image from "next/image";

export const mdxComponents: MDXComponents = {
  a: ({ href, children, ...props }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  img: ({ src, alt, ...props }) => {
    if (!src) return null;
    return (
      <Image
        src={src}
        alt={alt || ""}
        width={800}
        height={450}
        className="rounded-lg"
        {...props}
      />
    );
  },
};
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/mdx.ts src/components/mdx-components.tsx content/
git commit -m "feat: add MDX utilities and component map for blog/help content"
```

---

## Task 12: Blog Routes

Create the blog index and individual post pages with full SEO metadata and JSON-LD.

**Files:**
- Create: `src/app/blog/page.tsx`
- Create: `src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Create blog index page**

Create `src/app/blog/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Create blog post page**

Create `src/app/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { getBlogPost, getBlogPosts } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx-components";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  const { title, description, image } = post.frontmatter;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.frontmatter.date,
      ...(image && { images: [{ url: image }] }),
    },
    alternates: {
      canonical: `/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const { title, date, tags, description } = post.frontmatter;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: date,
    author: {
      "@type": "Organization",
      name: "BookClad",
    },
    publisher: {
      "@type": "Organization",
      name: "BookClad",
      url: "https://bookclad.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Link
          href="/blog"
          className="mb-8 inline-block text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Blog
        </Link>
        <article>
          <header className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            {tags && tags.length > 0 && (
              <div className="mt-2 flex gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <MDXRemote source={post.content} components={mdxComponents} />
          </div>
        </article>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/blog/
git commit -m "feat: add blog index and post pages with MDX rendering and SEO metadata"
```

---

## Task 13: Help Docs Routes

Create the help index (grouped by category) and individual doc pages.

**Files:**
- Create: `src/app/help/page.tsx`
- Create: `src/app/help/[slug]/page.tsx`

- [ ] **Step 1: Create help index page**

Create `src/app/help/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Create help doc page**

Create `src/app/help/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
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
          <MDXRemote source={doc.content} components={mdxComponents} />
        </div>
      </article>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/help/
git commit -m "feat: add help docs index and doc pages with MDX rendering"
```

---

## Task 14: Sitemap

Create dynamic sitemap that auto-includes static routes, blog posts, and help docs.

**Files:**
- Create: `src/app/sitemap.ts`

- [ ] **Step 1: Create sitemap.ts**

```ts
import type { MetadataRoute } from "next";
import { getBlogPosts, getHelpDocs } from "@/lib/mdx";

const BASE_URL = "https://bookclad.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/gallery`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const blogRoutes: MetadataRoute.Sitemap = getBlogPosts().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.frontmatter.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const helpRoutes: MetadataRoute.Sitemap = getHelpDocs().map((doc) => ({
    url: `${BASE_URL}/help/${doc.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes, ...helpRoutes];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "seo: add dynamic sitemap with static routes, blog posts, and help docs"
```

---

## Task 15: Gallery Stub

Create a placeholder gallery page that can be filled in later.

**Files:**
- Create: `src/app/gallery/page.tsx`

- [ ] **Step 1: Create gallery stub**

Create `src/app/gallery/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/gallery/page.tsx
git commit -m "feat: add gallery stub page"
```

---

## Task 16: Logo & Brand Assets (Interactive)

Design the logo, generate icon set, and create OG image. **This task requires user interaction** — iterate on the logo design until the user approves.

**Files:**
- Create: `src/app/favicon.ico`
- Create: `src/app/icon.svg`
- Create: `src/app/apple-icon.png`
- Create: `public/og-image.png`

- [ ] **Step 1: Design logo using `frontend-design` skill**

Use the `frontend-design` skill to create an SVG logo for BookClad:
- Clean, modern, works at favicon size (16x16) through hero size
- Book/cover-related iconography
- Works in both light and dark themes
- Iterate with user until approved

- [ ] **Step 2: Generate icon set from approved logo**

From the approved SVG, generate:
- `src/app/icon.svg` — the SVG logo itself
- `src/app/apple-icon.png` — 180x180 PNG export
- `src/app/favicon.ico` — multi-size ICO (16x16, 32x32)

Use RealFaviconGenerator or generate programmatically with sharp.

- [ ] **Step 3: Create OG image**

Create `public/og-image.png` (1200x630):
- BookClad logo prominently displayed
- Tagline: "AI-powered book cover generator for Kindle"
- Subtle gradient or background
- Can be created as an HTML/SVG template rendered to PNG

- [ ] **Step 4: Verify favicon loads in dev**

```bash
npm run dev
```

Open browser, check that the favicon appears in the tab. Check `/apple-icon.png` loads. Check that sharing `localhost:3000` in a tool like [metatags.io](https://metatags.io) shows the OG image.

- [ ] **Step 5: Commit**

```bash
git add src/app/favicon.ico src/app/icon.svg src/app/apple-icon.png public/og-image.png
git commit -m "brand: add logo, favicon, apple-touch-icon, and OG image"
```

---

## Task 17: Final Verification

Run a full build and verify everything works end-to-end.

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: build succeeds. Check that:
- `/robots.txt` is generated (visible in build output)
- `/sitemap.xml` is generated
- All new pages are listed in the build output

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no new warnings or errors.

- [ ] **Step 4: Visual spot-check**

```bash
npm run dev
```

Verify in browser:
- Landing page: JSON-LD visible in page source (`View Source` → search for `ld+json`)
- `/terms` page loads with correct content and metadata
- `/privacy` page has updated analytics/cookies sections
- `/blog` shows empty state
- `/help` shows empty state
- `/gallery` shows stub
- Cookie consent banner appears on first visit
- Footer has Terms link
- Sign-in page has Terms link

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "seo: final polish and fixes"
```
