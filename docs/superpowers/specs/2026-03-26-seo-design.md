# BookClad SEO Design Spec

**Date:** 2026-03-26
**Status:** Draft
**Domain:** bookclad.com (pre-launch)
**Target Audience:** Self-published Kindle/KDP authors

## Overview

Comprehensive SEO setup for BookClad covering technical foundation, content infrastructure, analytics, legal pages, and brand assets. Goal: organic search traffic from the KDP author niche, professional social sharing, and data-driven content decisions.

## Current State

**Good:**
- Root metadata (title + description) in `src/app/layout.tsx`
- Semantic HTML on landing page (proper heading hierarchy, `<main>`, `<section>`, `<footer>`)
- `next/image` with proper sizing and priority hints
- `next/font` with self-hosted Google Fonts (Geist)
- Image alt text on landing page components

**Missing:**
- Open Graph & Twitter Card tags
- Sitemap
- robots.txt
- JSON-LD structured data
- Favicon/icons
- Canonical URLs / `metadataBase`
- `noindex` on authenticated pages
- Page-level metadata beyond root layout
- Blog/help docs infrastructure
- Analytics
- Terms of use page

---

## Section 1: Technical SEO Foundation

### 1a. `metadataBase` + Root Metadata

Set `metadataBase` in root layout:

```ts
export const metadata: Metadata = {
  metadataBase: new URL("https://bookclad.com"),
  title: {
    default: "BookClad - AI Book Cover Generator",
    template: "%s | BookClad",
  },
  description: "Generate KDP-compliant Kindle ebook covers from natural language prompts. Genre-aware AI, typography, compliance checker — all in one flow.",
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
    description: "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "BookClad - AI Book Cover Generator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BookClad - AI Book Cover Generator",
    description: "Generate KDP-compliant Kindle ebook covers from natural language prompts.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://bookclad.com",
  },
}
```

### 1b. Page-Level Metadata

Each public page exports its own `metadata`:

| Page | Title | Description | OG Image |
|------|-------|-------------|----------|
| `/` (landing) | default from root | default from root | `/og-image.png` |
| `/privacy` | "Privacy Policy" | "How BookClad handles your data..." | inherits root |
| `/terms` | "Terms of Use" | "Terms and conditions for using BookClad..." | inherits root |
| `/blog` | "Blog" | "Tips and guides for self-publishing..." | inherits root |
| `/blog/[slug]` | from frontmatter | from frontmatter | from frontmatter or default |
| `/help` | "Help & Docs" | "Learn how to use BookClad..." | inherits root |
| `/help/[slug]` | from frontmatter | from frontmatter | inherits root |
| `/gallery` | "Cover Gallery" | "Covers created with BookClad..." | inherits root |

Authenticated pages get `noindex`:

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

Applied to: `/dashboard`, `/create`, `/editor/[id]`, `/settings`.

### 1c. `robots.ts`

File: `src/app/robots.ts`

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/create", "/editor", "/settings", "/api/"],
      },
    ],
    sitemap: "https://bookclad.com/sitemap.xml",
  }
}
```

### 1d. `sitemap.ts`

File: `src/app/sitemap.ts`

Dynamically generates sitemap entries from:
- Static routes: `/`, `/privacy`, `/terms`, `/gallery`
- Blog posts: reads `content/blog/*.mdx` frontmatter for slugs and dates
- Help docs: reads `content/help/*.mdx` frontmatter for slugs

Each entry includes `url`, `lastModified`, `changeFrequency`, and `priority`.

### 1e. JSON-LD Structured Data

Added to the landing page (`src/app/page.tsx`) as a `<script type="application/ld+json">`:

**Organization schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "BookClad",
  "url": "https://bookclad.com",
  "logo": "https://bookclad.com/icon.svg",
  "description": "AI-powered ebook cover generator for Amazon KDP"
}
```

**WebApplication schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "BookClad",
  "url": "https://bookclad.com",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "highPrice": "29",
    "priceCurrency": "USD"
  }
}
```

Blog posts get `BlogPosting` schema generated from frontmatter.

### 1f. Favicons & Icons

Generated from logo (see Section 4). Files placed in `src/app/`:
- `favicon.ico` (multi-size: 16x16, 32x32)
- `icon.svg` (scalable, for modern browsers)
- `apple-icon.png` (180x180)

Next.js App Router auto-detects these by convention when placed in `src/app/`.

OG image: `public/og-image.png` (1200x630) — branded social sharing card.

### 1g. Canonical URLs

Handled automatically by Next.js when `metadataBase` is set. Each page can override with `alternates.canonical` if needed. Blog posts use their slug as canonical: `https://bookclad.com/blog/[slug]`.

---

## Section 2: Content Infrastructure

### 2a. MDX Blog (`/blog`)

**Directory structure:**
```
content/
  blog/
    kdp-cover-requirements.mdx
    romance-cover-design-tips.mdx
    ...
```

**Frontmatter schema:**
```yaml
---
title: "KDP Cover Size Requirements in 2026"
description: "Everything you need to know about Amazon KDP cover dimensions, DPI, and file formats."
date: "2026-04-01"
tags: ["kdp", "requirements", "guide"]
image: "/blog/kdp-cover-requirements.png"  # optional OG image
---
```

**Routes:**
- `/blog` — index page listing all posts, sorted by date, with title + description + date
- `/blog/[slug]` — individual post rendered from MDX with auto-generated metadata

**Tech:** `next-mdx-remote` for rendering MDX with custom React components. Utility functions in `src/lib/blog.ts` for reading/parsing content directory.

**SEO per post:** `generateMetadata()` reads frontmatter and returns title, description, OG image, canonical URL, and `BlogPosting` JSON-LD.

### 2b. Help Docs (`/help`)

**Directory structure:**
```
content/
  help/
    getting-started.mdx
    using-the-editor.mdx
    exporting-covers.mdx
    ...
```

**Frontmatter schema:**
```yaml
---
title: "Getting Started with BookClad"
description: "Create your first AI-generated book cover in under 5 minutes."
category: "Getting Started"
order: 1
---
```

**Routes:**
- `/help` — index page grouped by category, sorted by `order`
- `/help/[slug]` — individual doc page

**Tech:** Same `next-mdx-remote` setup as blog. Utility functions in `src/lib/help.ts`.

### 2c. Public Gallery (`/gallery`)

Stubbed route with basic layout. Full implementation deferred. Will display curated covers with alt text including genre/style metadata for image search visibility.

### 2d. Sitemap Auto-Generation

`sitemap.ts` reads from `content/blog/` and `content/help/` at build time. Every new MDX file automatically appears in the sitemap — no manual updates needed.

---

## Section 3: Analytics & Legal

### 3a. Google Search Console

Manual setup (not code):
1. Add DNS TXT record in Cloudflare to verify `bookclad.com`
2. Add verification meta tag to root metadata as a fallback

Code adds the meta tag:
```ts
verification: {
  google: "VERIFICATION_CODE_HERE",  // from env var
}
```

### 3b. Google Analytics 4

**Script loading:** Conditionally load GA4 `<script>` only after the user accepts cookies. Use Next.js `<Script strategy="afterInteractive">` component.

**Cookie consent banner:**
- A client component rendered in root layout
- Shows on first visit: "We use cookies to understand how you use our site. [Accept] [Decline]"
- Stores consent in `localStorage` (key: `cookie-consent`, values: `"accepted"` | `"declined"`)
- If accepted: loads GA4 script, sets consent mode to `granted`
- If declined: GA4 never loads
- Banner doesn't re-appear after choice is made
- Minimal, non-intrusive design anchored to bottom of viewport

**GA4 configuration:**
- Tracking ID from env var: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Default consent mode: `denied` (respects user choice)
- Events tracked: page views (automatic), sign-up conversions, generation triggers (custom events later)

**Component structure:**
- `src/components/cookie-consent.tsx` — banner UI + localStorage logic
- `src/components/google-analytics.tsx` — conditional script loader
- Both rendered in root layout, client-side only

### 3c. Privacy Policy Update

Add sections to `src/app/privacy/page.tsx`:
- **Analytics:** Disclose use of Google Analytics 4, what data is collected (page views, device info, referrer), purpose (improving the service), that users can opt out via the cookie banner
- **Cookies:** List cookies used — GA4 cookies (`_ga`, `_ga_*`), consent cookie (`cookie-consent` in localStorage)
- Update "Last updated" date

### 3d. Terms of Use (`/terms`)

New static page at `src/app/terms/page.tsx`. Covers:
- **Acceptance of terms** — by using the service, you agree
- **Service description** — AI-generated book covers
- **User accounts** — responsibilities, security
- **Intellectual property** — AI-generated covers: user owns the output, BookClad retains right to display in gallery if user opts in
- **Acceptable use** — no illegal content, no trademark infringement
- **Credits and billing** — non-refundable purchases, subscription terms
- **Limitation of liability** — standard SaaS limitations
- **Termination** — either party can terminate, account deletion available
- **Changes to terms** — we can update, users notified via email or site notice

Add footer link and sign-in page link (same pattern as privacy policy).

---

## Section 4: Logo & Brand Assets

### 4a. Logo Design

Use `frontend-design` skill to create an SVG logo:
- Clean, modern design that works at all sizes (favicon to hero)
- Book/cover-related iconography
- Works in both light and dark themes
- Iterate with user until approved

### 4b. Icon Set

Generated from approved logo:
- `src/app/favicon.ico` (16x16, 32x32)
- `src/app/icon.svg` (scalable)
- `src/app/apple-icon.png` (180x180)

### 4c. OG Image

1200x630 branded social sharing card:
- Logo prominently displayed
- Tagline: "AI-powered book cover generator for Kindle"
- Subtle background (gradient or faded cover examples)
- Stored at `public/og-image.png`

---

## File Changes Summary

**New files:**
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/terms/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/help/page.tsx`
- `src/app/help/[slug]/page.tsx`
- `src/app/gallery/page.tsx`
- `src/lib/blog.ts`
- `src/lib/help.ts`
- `src/components/cookie-consent.tsx`
- `src/components/google-analytics.tsx`
- `content/blog/` (directory, starter post optional)
- `content/help/` (directory, starter doc optional)
- `src/app/favicon.ico`
- `src/app/icon.svg`
- `src/app/apple-icon.png`
- `public/og-image.png`

**Modified files:**
- `src/app/layout.tsx` — metadataBase, enhanced metadata, icons, GA verification, render cookie consent + analytics components
- `src/app/page.tsx` — JSON-LD structured data
- `src/app/privacy/page.tsx` — analytics/cookies disclosure, updated date
- `src/app/dashboard/page.tsx` — add `robots: noindex`
- `src/app/create/page.tsx` — add `robots: noindex`
- `src/app/editor/[id]/page.tsx` — add `robots: noindex`
- `src/app/settings/page.tsx` — add `robots: noindex`
- Landing page footer — add Terms link
- Sign-in page — add Terms link

**New dependencies:**
- `next-mdx-remote` — MDX rendering for blog/help
- No analytics dependency needed (GA4 loaded via `<script>` tag)

**Environment variables (new):**
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 tracking ID
- `GOOGLE_SITE_VERIFICATION` — Search Console verification code (optional, can also do DNS)

---

## Out of Scope

- Actual blog post content writing (infrastructure only)
- Actual help doc content writing (infrastructure only)
- Full gallery implementation (stub only)
- Google Ads or paid search
- Link building / off-page SEO
- International SEO / multi-language
- AMP pages
- Performance optimization beyond what Next.js provides by default
