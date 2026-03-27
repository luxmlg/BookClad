# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the landing page with real product screenshots, AI-generated covers, scroll animations via Framer Motion, and updated feature text.

**Architecture:** Add `motion` package for animations. Create 4 new landing components (`FadeIn`, `ThemedImage`, `ProductShowcase`, `HeroCoverFan`). Update `CoverCarousel` to use real images with attribute badges. Update `page.tsx` to compose the new page flow with updated text.

**Tech Stack:** Next.js 16, React 19, motion (Framer Motion), next/image, next-themes, Embla Carousel, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-24-landing-page-redesign.md`

---

## File Structure

**Create:**
- `src/components/landing/fade-in.tsx` — Reusable scroll-triggered animation wrapper
- `src/components/landing/themed-image.tsx` — Theme-aware image with crossfade
- `src/components/landing/hero-cover-fan.tsx` — 3 fanned covers with entrance + float animation
- `src/components/landing/product-showcase.tsx` — 4 alternating screenshot + text rows

**Modify:**
- `src/components/landing/cover-carousel.tsx` — Real images, attribute badges, updated data
- `src/app/page.tsx` — New page flow, updated hero/feature text, compose new sections

---

### Task 1: Install motion package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install motion**

```bash
npm install motion
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('motion/react'); console.log('motion OK')"
```
Expected: `motion OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add motion (Framer Motion) for landing page animations"
```

---

### Task 2: Create FadeIn component

**Files:**
- Create: `src/components/landing/fade-in.tsx`

This is a reusable wrapper that fades in and slides up children when they enter the viewport.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  /** Distance in pixels to slide up from. Default 20. */
  y?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className,
  y = 20,
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/fade-in.tsx
git commit -m "feat: add FadeIn animation component"
```

---

### Task 3: Create ThemedImage component

**Files:**
- Create: `src/components/landing/themed-image.tsx`

Renders both light and dark images stacked, crossfades based on resolved theme. Defaults to light until mounted to prevent SSR flash.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect } from "react";
import Image, { type ImageProps } from "next/image";
import { useTheme } from "next-themes";

interface ThemedImageProps {
  lightSrc: ImageProps["src"];
  darkSrc: ImageProps["src"];
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

export function ThemedImage({
  lightSrc,
  darkSrc,
  alt,
  width,
  height,
  priority,
  className,
}: ThemedImageProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`transition-opacity duration-300 ${isDark ? "opacity-0" : "opacity-100"}`}
      />
      <Image
        src={darkSrc}
        alt={`${alt} (dark)`}
        width={width}
        height={height}
        priority={priority}
        className={`absolute inset-0 transition-opacity duration-300 ${isDark ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
```

**Key details:**
- `mounted` state guard prevents SSR flash — defaults to light image until `useEffect` fires
- `resolvedTheme` gives actual `"light"` or `"dark"` (not `"system"`)
- Both images always rendered; only opacity changes — no layout shift, no loading delay on switch
- Uses `next/image` for optimization (WebP, resizing)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/themed-image.tsx
git commit -m "feat: add ThemedImage component with theme crossfade"
```

---

### Task 4: Create HeroCoverFan component

**Files:**
- Create: `src/components/landing/hero-cover-fan.tsx`

Displays 3 cover images fanned out below the hero CTA. Entrance animation + gentle floating bob.

- [ ] **Step 1: Create the component**

The component receives 3 cover image paths and renders them fanned. Left cover tilts -6deg, center is straight, right tilts +6deg. Center is slightly larger. All fly in from below on mount, then gently bob.

```tsx
"use client";

import Image from "next/image";
import { motion } from "motion/react";

interface HeroCoverFanProps {
  covers: [string, string, string];
}

const fanConfig = [
  { rotate: -6, x: 20, scale: 0.92, zIndex: 10 },
  { rotate: 0, x: 0, scale: 1, zIndex: 20 },
  { rotate: 6, x: -20, scale: 0.92, zIndex: 10 },
] as const;

export function HeroCoverFan({ covers }: HeroCoverFanProps) {
  return (
    <div className="relative mx-auto mt-14 flex items-center justify-center">
      {covers.map((src, i) => (
        <motion.div
          key={i}
          className="relative"
          style={{
            zIndex: fanConfig[i].zIndex,
            marginLeft: i === 0 ? 0 : -24,
          }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.5 + i * 0.1,
            ease: "easeOut",
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
            style={{
              rotate: fanConfig[i].rotate,
              scale: fanConfig[i].scale,
              x: fanConfig[i].x,
            }}
          >
            <Image
              src={src}
              alt=""
              width={200}
              height={320}
              priority
              className="rounded-xl shadow-2xl ring-1 ring-foreground/10"
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
```

**Notes:**
- `priority` on all 3 images since they're above the fold
- `marginLeft: -24` on non-first covers creates overlap
- Float animation uses `y: [0, -6, 0]` with `repeat: Infinity`
- Mobile: component naturally shrinks since Image scales with container; the 200px width fits 3 covers even on small screens

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/hero-cover-fan.tsx
git commit -m "feat: add HeroCoverFan with entrance and float animation"
```

---

### Task 5: Create ProductShowcase component

**Files:**
- Create: `src/components/landing/product-showcase.tsx`

4 alternating image + text rows with themed screenshots.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Sparkles, Layers, Images, Type } from "lucide-react";
import { FadeIn } from "./fade-in";
import { ThemedImage } from "./themed-image";

const showcaseItems = [
  {
    icon: Sparkles,
    heading: "Describe Your Book, Get Covers",
    text: "Enter your title, author, and a short description. Our AI picks the genre, mood, art style, and visual attributes — then generates covers in one click.",
    lightSrc: "/landing/create-light.png",
    darkSrc: "/landing/create-dark.png",
    alt: "Quick Create form",
  },
  {
    icon: Layers,
    heading: "A Full Canvas Editor",
    text: "Fine-tune every detail. Add title and author text with genre-matched fonts, adjust layers, and preview exactly how your cover will look on a Kindle.",
    lightSrc: "/landing/editor-light.png",
    darkSrc: "/landing/editor-dark.png",
    alt: "Cover editor",
  },
  {
    icon: Images,
    heading: "Compare and Iterate",
    text: "Every generation is saved with its attributes. Browse your history, see what changed between versions, and pick the best result.",
    lightSrc: "/landing/results-light.png",
    darkSrc: "/landing/results-dark.png",
    alt: "Generation results",
  },
  {
    icon: Type,
    heading: "Typography That Fits",
    text: "Add title, subtitle, and author name with built-in fonts organized by genre. Safe-zone guides keep your text where KDP expects it.",
    lightSrc: "/landing/canvas-light.png",
    darkSrc: "/landing/canvas-dark.png",
    alt: "Canvas typography",
  },
];

export function ProductShowcase() {
  return (
    <section className="container mx-auto max-w-6xl px-4 py-28">
      <FadeIn className="mb-16 text-center">
        <p className="mb-3 text-sm font-medium tracking-widest text-muted-foreground/70 uppercase">
          Product
        </p>
        <h2 className="text-3xl font-bold">See It in Action</h2>
        <p className="mt-3 text-muted-foreground">
          From description to publish-ready cover in minutes.
        </p>
      </FadeIn>

      <div className="space-y-24">
        {showcaseItems.map((item, i) => {
          const imageLeft = i % 2 === 0;
          return (
            <FadeIn key={item.heading}>
              <div
                className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16 ${
                  !imageLeft ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Screenshot */}
                <div className="lg:w-[60%]">
                  <ThemedImage
                    lightSrc={item.lightSrc}
                    darkSrc={item.darkSrc}
                    alt={item.alt}
                    width={1200}
                    height={750}
                    className="overflow-hidden rounded-xl shadow-xl ring-1 ring-foreground/10"
                  />
                </div>

                {/* Text */}
                <div className="lg:w-[40%]">
                  <div className="mb-4 inline-flex rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-2.5">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-3 text-2xl font-semibold">{item.heading}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            </FadeIn>
          );
        })}
      </div>
    </section>
  );
}
```

**Key details:**
- `imageLeft = i % 2 === 0` alternates layout at `lg`+
- Below `lg`: always stacked (image on top, text below) — `flex-col` base
- `ThemedImage` width/height are approximate aspect ratio hints for `next/image`; actual display is controlled by the container
- Screenshots should be provided at ~2400px wide (2x for retina)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/product-showcase.tsx
git commit -m "feat: add ProductShowcase with alternating rows and themed screenshots"
```

---

### Task 6: Update CoverCarousel with real images and attribute badges

**Files:**
- Modify: `src/components/landing/cover-carousel.tsx`

Replace CSS gradient covers with real images. Add attribute badges below active cover. Use `AnimatePresence` for badge transitions.

- [ ] **Step 1: Update the covers data array**

Replace the entire `covers` array (lines 8-51) with:

```tsx
const covers = [
  {
    image: "/landing/covers/cover-1.jpg",
    genre: "Thriller",
    title: "The Last Witness",
    author: "James Mercer",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-2.jpg",
    genre: "Romance",
    title: "Where Peonies Bloom",
    author: "Claire Fontaine",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-3.jpg",
    genre: "Fantasy",
    title: "Crown of Embers",
    author: "R.K. Ashwood",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-4.jpg",
    genre: "Sci-Fi",
    title: "Neon Horizon",
    author: "Dex Omari",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-5.jpg",
    genre: "Horror",
    title: "Hollow Ground",
    author: "M. Blackwell",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-6.jpg",
    genre: "Literary Fiction",
    title: "The Weight of Small Things",
    author: "Nora Chen",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-7.jpg",
    genre: "Self-Help",
    title: "Atomic Focus",
    author: "Dr. Lena Park",
    attributes: [] as string[],
  },
  {
    image: "/landing/covers/cover-8.jpg",
    genre: "Mystery",
    title: "The Vanishing Tide",
    author: "Sable Drake",
    attributes: [] as string[],
  },
];
```

**Note:** `attributes` arrays are empty for now — user will populate them after generating covers. When empty, no badge row renders.

- [ ] **Step 2: Add imports**

Add to the top of the file:

```tsx
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
```

- [ ] **Step 3: Replace the cover rendering**

Replace the inner cover `<div>` that uses `bg-gradient-to-br ${cover.gradient}` (lines 101-141) with an `<Image>` component:

```tsx
{/* Cover */}
<div
  className={`relative aspect-[5/8] overflow-hidden ${
    isActive ? "rounded-xl" : "rounded-xl shadow-xl"
  }`}
>
  <Image
    src={cover.image}
    alt={`${cover.title} by ${cover.author}`}
    fill
    sizes="240px"
    className="object-cover"
    priority={i <= 2}
  />
</div>
```

The old decorative elements (glyphs, genre label, title text, horizontal rule) are removed — the real cover images already have all that baked in.

- [ ] **Step 4: Add attribute badges below dot indicators**

After the dot indicators `<div>` (line 186), add the attribute badge section:

```tsx
{/* Attribute badges for active cover */}
<AnimatePresence mode="wait">
  {covers[selectedIndex].attributes.length > 0 && (
    <motion.div
      key={selectedIndex}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
    >
      {covers[selectedIndex].attributes.map((attr) => (
        <span
          key={attr}
          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {attr}
        </span>
      ))}
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/cover-carousel.tsx
git commit -m "feat: update carousel with real cover images and attribute badges"
```

---

### Task 7: Update page.tsx — full page composition

**Files:**
- Modify: `src/app/page.tsx`

This is the main integration task. Updates the hero text, adds the hero cover fan, adds the product showcase section, updates feature card text, and wraps sections with `FadeIn`.

- [ ] **Step 1: Update imports**

Replace the current imports (lines 1-16) with:

```tsx
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Download,
  Type,
  Paintbrush,
  Wand,
  History,
  Check,
  ArrowRight,
  Coins,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { CoverCarousel } from "@/components/landing/cover-carousel";
import { HeroCoverFan } from "@/components/landing/hero-cover-fan";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { FadeIn } from "@/components/landing/fade-in";
```

**Note:** `page.tsx` remains a server component. All animation components (`FadeIn`, `HeroCoverFan`, `ProductShowcase`, `CoverCarousel`) are `"use client"` components that `page.tsx` composes. Server-rendered JSX passed as `children` to `FadeIn` is serialized across the boundary automatically by React.

Removed imports: `ShieldCheck`, `Zap`. Added: `Wand`, `History`, `HeroCoverFan`, `ProductShowcase`, `FadeIn`.

- [ ] **Step 2: Update the features array**

Replace cards 5 and 6 (lines 43-54):

```tsx
const features = [
  {
    icon: Sparkles,
    title: "Genre-Aware AI",
    description:
      "Our AI understands the visual language of thriller, romance, fantasy, and 10+ genres — your cover signals the right shelf instantly.",
  },
  {
    icon: Download,
    title: "KDP-Ready Export",
    description:
      "Every cover exports at 1600 x 2560 px, RGB, 300 DPI JPEG — guaranteed compliant with Amazon KDP specifications.",
  },
  {
    icon: Type,
    title: "Built-in Typography",
    description:
      "Add title, subtitle, and author name with genre-matched fonts, safe-zone guides, and legibility effects.",
  },
  {
    icon: Paintbrush,
    title: "AI Region Editing",
    description:
      "Don't like the sky? Paint over it and describe the change. Refine without regenerating the entire cover.",
  },
  {
    icon: Wand,
    title: "AI-Powered Quick Create",
    description:
      "Describe your book and get covers in one click. Our AI analyzes your description and automatically selects genre, mood, art style, and visual attributes — no design decisions needed.",
  },
  {
    icon: History,
    title: "Generation History",
    description:
      "Every generation is saved with its attributes. Compare results side-by-side, see what changed, and revert to any previous version.",
  },
];
```

Note: `ShieldCheck` and `Zap` are removed from imports; `Wand` and `History` are added.

- [ ] **Step 3: Update the hero section**

Replace the hero `<section>` (lines 101-155) with:

```tsx
{/* Hero */}
<section className="relative overflow-hidden">
  <div className="absolute inset-0 -z-10 dot-grid mask-radial-fade" />
  <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_-20%,oklch(0.556_0_0/0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_50%_-20%,oklch(0.985_0_0/0.04)_0%,transparent_70%)]" />

  <div className="container mx-auto max-w-4xl px-4 py-32 text-center lg:py-40">
    <FadeIn delay={0}>
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
        <Sparkles className="size-3.5 text-primary animate-shimmer" />
        AI-powered cover generation
      </div>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-7xl">
        Your Book Deserves a Cover
        <br />
        <span className="relative inline-block">
          That Sells
          <span
            className="absolute -bottom-1 left-0 h-3 w-full rounded-sm bg-primary/15"
            aria-hidden="true"
          />
        </span>
      </h1>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Describe your story, choose a style, and get KDP-ready cover options
        in minutes. Fine-tune with typography, AI region editing, and
        one-click export.
      </p>
    </FadeIn>
    <FadeIn delay={0.3}>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/create"
          className={buttonVariants({
            size: "lg",
            className: "h-11 gap-2 px-8 text-base shadow-lg shadow-primary/10",
          })}
        >
          Start Free <ArrowRight className="size-4" />
        </Link>
        <Link
          href="#features"
          className={buttonVariants({
            size: "lg",
            variant: "outline",
            className: "h-11 px-8 text-base",
          })}
        >
          See Features
        </Link>
      </div>
    </FadeIn>
    <FadeIn delay={0.4}>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <Check className="size-3.5 text-primary" />
        Start with 25 free credits. No credit card required.
      </p>
    </FadeIn>

    {/* Cover fan */}
    <HeroCoverFan
      covers={[
        "/landing/covers/cover-1.jpg",
        "/landing/covers/cover-4.jpg",
        "/landing/covers/cover-2.jpg",
      ]}
    />
  </div>
</section>
```

**Changes from current:**
- Hero text elements wrapped in `FadeIn` with staggered delays
- Subheading updated (no "4 covers" hardcode)
- `font-bold` → `font-extrabold` on h1
- `HeroCoverFan` added below the trust line
- Cover fan uses covers 1 (Thriller), 4 (Sci-Fi), 2 (Romance) for visual variety

- [ ] **Step 4: Add ProductShowcase between carousel and features**

After the carousel `<section>` and before the features `<section>`, add:

```tsx
{/* Product showcase */}
<ProductShowcase />
```

- [ ] **Step 5: Wrap feature cards with FadeIn**

Replace the feature cards grid (around line 181-197) with staggered FadeIn:

```tsx
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
  {features.map((f, i) => (
    <FadeIn key={f.title} delay={i * 0.15}>
      <div className="group relative overflow-hidden rounded-xl bg-card p-6 ring-1 ring-foreground/[0.05] transition-all duration-200 hover:shadow-lg hover:ring-foreground/15">
        <div className="absolute inset-x-0 top-0 h-px bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="mb-4 inline-flex rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-2.5">
          <f.icon className="size-5 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
        <p className="text-[0.8125rem] leading-6 text-muted-foreground">
          {f.description}
        </p>
      </div>
    </FadeIn>
  ))}
</div>
```

- [ ] **Step 6: Wrap pricing cards with FadeIn**

Wrap each pricing `<Card>` in a `<FadeIn>` with staggered delays:

```tsx
{plans.map((plan, i) => (
  <FadeIn key={plan.name} delay={i * 0.1}>
    <Card
      className={`flex flex-col ${
        plan.highlighted
          ? "relative z-10 scale-[1.02] overflow-visible border-transparent bg-primary text-primary-foreground ring-0 shadow-xl"
          : ""
      }`}
    >
      {/* ... rest of card unchanged ... */}
    </Card>
  </FadeIn>
))}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 8: Lint**

```bash
npx eslint src/app/page.tsx src/components/landing/
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing page with animations, showcase, and updated text"
```

---

### Task 8: Create placeholder images and verify

**Files:**
- Create: `public/landing/` directory with placeholder images

Until the user provides real screenshots and covers, create simple placeholder images so the page renders without broken images.

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p public/landing/covers
```

- [ ] **Step 2: Create placeholder images**

Use a simple script to generate colored placeholder PNGs (or just create empty files that `next/image` can handle). Alternatively, check if the page renders gracefully when images are missing (it will show broken image icons).

Generate valid placeholder images using `sharp` (already a project dependency via `next/image`):

```bash
# Cover placeholders (5:8 aspect ratio, gray, JPEG)
for i in 1 2 3 4 5 6 7 8; do
  node -e "require('sharp')({create:{width:200,height:320,channels:3,background:{r:64,g:64,b:64}}}).jpeg({quality:50}).toFile('public/landing/covers/cover-$i.jpg')"
done

# Screenshot placeholders (16:10 aspect ratio, gray, PNG)
for name in editor create results canvas; do
  for mode in light dark; do
    node -e "require('sharp')({create:{width:1200,height:750,channels:3,background:{r:$( [ \"$mode\" = 'dark' ] && echo 32 || echo 220 ),g:$( [ \"$mode\" = 'dark' ] && echo 32 || echo 220 ),b:$( [ \"$mode\" = 'dark' ] && echo 32 || echo 220 )}}}).png().toFile('public/landing/$name-$mode.png')"
  done
done
```

These are valid images that `next/image`/`sharp` can process without errors. The user will replace them with real assets.

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Visit `http://localhost:3000` and verify:
1. Hero section renders with staggered animations
2. Cover fan area shows (even if images are placeholder/broken)
3. Carousel renders (images may be placeholder)
4. Product showcase section renders with themed images
5. Features section shows updated text (Quick Create, Generation History)
6. Pricing section renders with fade-in animations
7. Toggle dark/light theme — ThemedImage crossfades

- [ ] **Step 4: Commit**

```bash
git add public/landing/
git commit -m "chore: add placeholder images for landing page (to be replaced with real assets)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full type-check**

```bash
npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 2: Lint all changed files**

```bash
npx eslint src/app/page.tsx src/components/landing/
```
Expected: PASS

- [ ] **Step 3: Visual check**

Start dev server and verify:
1. Page loads without errors in browser console
2. Scroll animations trigger once when sections enter viewport
3. Hero entrance animation plays on page load
4. Cover fan floats gently
5. Carousel autoplay works, attribute badges animate on slide change
6. Theme toggle crossfades screenshots smoothly
7. Mobile responsive — check at 375px width
8. All links work (Start Free, See Features, pricing CTAs, footer)
