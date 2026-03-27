# BookClad Content Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write 5 blog posts and 4 help docs as MDX files, ready to publish.

**Architecture:** Pure content — MDX files dropped into `content/blog/` and `content/help/`. No code changes needed. Rendering infrastructure already exists (`src/lib/mdx.ts`, `src/app/blog/`, `src/app/help/`). Files auto-appear in sitemap.

**Tech Stack:** MDX with YAML frontmatter, rendered by `next-mdx-remote/rsc` with custom components from `src/components/mdx-components.tsx` (supports `Link` for internal URLs, `Image` for images).

**Spec:** `docs/superpowers/specs/2026-03-27-content-strategy-design.md`

**Tone:** Friendly and practical — casual but knowledgeable, like advice from someone who's actually published books. Not corporate, not overly casual. Lead with universal value, weave in BookClad naturally (not forced promotion).

**Date for all content:** `2026-03-27`

---

## Writing Guidelines

**Screenshot placeholders:** Include HTML comments where screenshots should eventually go, e.g. `{/* Screenshot: editor with text layers visible */}`. The user will provide actual screenshots later.

**Cross-linking:** Use internal links between related content. The MDX component map converts internal links to Next.js `Link` components. Examples:
- Blog post mentioning the editor → link to `/help/the-cover-editor`
- Help doc mentioning credits → link to `/help/understanding-credits`
- Blog post about typography → link to `/blog/how-to-add-text-to-ai-book-cover`

**Prices:** Subscription plan prices are intentionally omitted (shown as "varies") to avoid hardcoding values that may change. Direct users to the pricing page or Settings > Billing.

---

## File Structure

All new files — no modifications to existing code.

| File | Purpose |
|------|---------|
| `content/blog/amazon-kdp-cover-requirements-2026.mdx` | Blog: KDP specs guide |
| `content/blog/book-cover-design-trends-by-genre-2026.mdx` | Blog: Genre trends |
| `content/blog/ai-book-cover-design-what-works.mdx` | Blog: AI covers honest take |
| `content/blog/book-cover-mistakes-that-kill-sales.mdx` | Blog: 5 mistakes listicle |
| `content/blog/how-to-add-text-to-ai-book-cover.mdx` | Blog: Typography tutorial |
| `content/help/creating-your-first-cover.mdx` | Help: Getting started walkthrough |
| `content/help/understanding-credits.mdx` | Help: Credit system explained |
| `content/help/the-cover-editor.mdx` | Help: Editor reference |
| `content/help/tips-for-better-results.mdx` | Help: Generation tips |

---

## Task 1: Blog Post — Amazon KDP Book Cover Requirements

**Files:**
- Create: `content/blog/amazon-kdp-cover-requirements-2026.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "Amazon KDP Book Cover Requirements: The Complete Guide for 2026"
description: "Everything you need to know about Amazon KDP cover specs — dimensions, DPI, file format, and how to get them right every time."
date: "2026-03-27"
tags: ["kdp", "cover-requirements", "self-publishing"]
---
```

Content outline (1200-1500 words):
1. **Opening** — Why getting cover specs right matters. Amazon rejects non-compliant covers. Even if accepted, wrong specs = blurry thumbnails and lost sales.
2. **The exact specs** — 1600x2560 pixels, 300 DPI, 5:8 aspect ratio, JPEG format, max 50MB. Explain what each means in plain English.
3. **Aspect ratio explained** — 5:8 is not 9:16 (phone screens) or 2:3 (print standard). Show the math: 1600/2560 = 0.625. Why this matters when using design tools.
4. **File format and quality** — JPEG at quality 92 is the sweet spot. PNG is larger with no visual benefit at this size. RGB color space for ebook (CMYK is for print/paperback only).
5. **Common mistakes** — Wrong DPI (designing at 72 DPI then upscaling = blurry), wrong color space (CMYK for ebook = muted colors), forgetting bleed for paperback wraparound covers, wrong aspect ratio (stretching/cropping visible).
6. **BookClad angle** (natural, not salesy) — If you use BookClad, these specs are handled automatically. Generation targets 1600x2560, export produces KDP-compliant JPEG at 300 DPI. No manual resizing or Photoshop required. Brief mention, not a pitch.
7. **Quick reference table** — Summary of all specs in a scannable table.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/blog/amazon-kdp-cover-requirements-2026.mdx`

Expected: Valid YAML frontmatter with title, description, date, tags between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/blog/amazon-kdp-cover-requirements-2026.mdx
git commit -m "content: add KDP cover requirements blog post"
```

---

## Task 2: Blog Post — Book Cover Design Trends by Genre

**Files:**
- Create: `content/blog/book-cover-design-trends-by-genre-2026.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "Book Cover Design Trends by Genre: What's Selling in 2026"
description: "A visual breakdown of what's working on bestseller lists across romance, thriller, fantasy, sci-fi, and literary fiction — and how to apply these trends to your cover."
date: "2026-03-27"
tags: ["cover-design", "genre-trends", "self-publishing"]
---
```

Content outline (1500-1800 words):
1. **Opening** — Readers judge covers in under a second. Genre signaling is the single most important job your cover does. A gorgeous cover in the wrong genre language will tank your sales.
2. **Romance** — Warm palettes (blush, gold, sunset tones). Illustrated couples trending over photo-realistic. Script and handwritten fonts for titles. Soft lighting, dreamy atmosphere. Sub-genre variations: dark romance (moody, shadowy), cozy romance (pastels, whimsical), contemporary (clean, bright).
3. **Thriller/Mystery** — Dark tones, high contrast. Bold sans-serif typography, often distressed or textured. Silhouettes, cityscapes, isolated figures. Red accents for urgency. Negative space creates tension.
4. **Fantasy** — Rich detail, ornate borders and typography. Jewel tones (deep purple, emerald, gold). Illustrated characters or symbolic objects. Epic scale — landscapes, castles, magical elements. Sub-genre: romantasy blends fantasy with romance aesthetics.
5. **Sci-fi** — Minimalist and geometric. Cool blues, teals, neon accents. Clean sans-serif fonts. Abstract shapes, space imagery, tech elements. Less is more — the genre signals sophistication through restraint.
6. **Literary fiction** — Restrained, conceptual. Serif fonts (Garamond, Baskerville types). Muted palettes, single symbolic image. Whitespace as a design element. The cover says "this is serious writing" through what it leaves out.
7. **BookClad angle** — The attribute system (genre, mood, art style, color palette) maps directly to these trends. Select "Dark Romance" + "Moody" + "Illustrated" + warm palette and you're already in the right visual territory. AI Fill can suggest the right combination if you describe your book.

**Writer note:** Stay focused on what's selling on actual bestseller lists. Don't duplicate the how-to attribute advice in Help Doc 4.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/blog/book-cover-design-trends-by-genre-2026.mdx`

Expected: Valid YAML frontmatter with title, description, date, tags between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/blog/book-cover-design-trends-by-genre-2026.mdx
git commit -m "content: add genre cover design trends blog post"
```

---

## Task 3: Blog Post — AI Book Cover Design: What Works

**Files:**
- Create: `content/blog/ai-book-cover-design-what-works.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "AI Book Cover Design: What Actually Works (and What Doesn't)"
description: "An honest look at AI-generated book covers — where they excel, where they fall short, and how to get professional results."
date: "2026-03-27"
tags: ["ai-design", "cover-design", "tools"]
---
```

Content outline (1500-1800 words):
1. **Opening** — AI cover design has gone from novelty to legitimate tool in a short time. But the hype and the reality don't always match. Here's an honest assessment from people who build AI cover tools.
2. **Where AI excels** — Concept exploration (generate 10 directions in minutes vs. days with a designer), iteration speed (tweak mood/style/palette and regenerate), cost efficiency (a few credits vs. $200-500 per designer), style consistency (same attribute set = cohesive series covers).
3. **Where AI struggles** — Very specific compositions ("character holding a glowing sword in left hand while standing on a cliff at sunset" — AI interprets loosely), photorealistic hands and faces (getting better but still imperfect), exact text rendering (AI-generated text in images is unreliable — this is a known limitation across all AI image models).
4. **The key insight** — AI is a creative partner, not a one-click solution. The best results come from: clear inputs → multiple generations → human curation → manual typography → final polish. Think of it like having a fast, tireless artist who needs art direction.
5. **How to get better results** — Be specific with descriptions (not "thriller book" but "dark psychological thriller set in a crumbling Victorian mansion at dusk"). Use structured attributes over free-text dumping. Iterate in tiers: Quick (available to all, 3 credits) for rapid exploration, Detailed (requires Starter plan, 5 credits) for final-quality output, Premium (requires Starter plan, 10 credits) for maximum quality.
6. **The text problem and how to solve it** — Don't ask AI to render your title. Instead: generate the artwork without text, then add typography in a proper editor with real fonts and precise control. Or use "bake layers" to have AI integrate your text into the artwork with genre-appropriate effects (embossed metal for fantasy, neon glow for sci-fi, elegant script for romance).
7. **BookClad angle** — The attribute system replaces vague prompts with structured creative direction. Three model tiers match different stages of the creative process. Canvas editor handles typography with real fonts. Bake layers bridge the gap between AI art and professional text integration.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/blog/ai-book-cover-design-what-works.mdx`

Expected: Valid YAML frontmatter with title, description, date, tags between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/blog/ai-book-cover-design-what-works.mdx
git commit -m "content: add AI book cover design blog post"
```

---

## Task 4: Blog Post — 5 Cover Mistakes That Kill Sales

**Files:**
- Create: `content/blog/book-cover-mistakes-that-kill-sales.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "5 Book Cover Mistakes That Kill Sales (and How to Fix Them)"
description: "The most common cover design mistakes self-published authors make — and practical fixes for each one."
date: "2026-03-27"
tags: ["cover-design", "self-publishing", "tips"]
---
```

Content outline (1200-1500 words):
1. **Opening** — Your cover is your book's first impression — and often its only chance. These five mistakes are the most common reasons self-published books get scrolled past.
2. **Mistake 1: Wrong genre signals** — A soft watercolor cover on a hard-boiled thriller. An edgy dark design on a cozy romance. Readers use covers to filter. Wrong signals = wrong audience = no sales. **Fix:** Study the top 20 bestsellers in your specific sub-genre. Note the colors, fonts, imagery style. Your cover should feel like it belongs on that shelf. Use genre-specific attributes when generating.
3. **Mistake 2: Illegible at thumbnail size** — Your cover looks great at full size but your title disappears at 300px wide — which is how most readers first see it on Amazon. **Fix:** Design for the thumbnail first. Your title should be readable at 300px. Use high contrast between text and background. Bold, clean fonts. Test by shrinking your cover to thumbnail size before committing.
4. **Mistake 3: Amateur typography** — Too many fonts (more than 2 is almost always too many), poor letter spacing, default system fonts, text that fights with the background. Typography is what separates professional covers from DIY. **Fix:** Maximum 2 fonts — one for title, one for author name. Use generous letter spacing. Choose fonts that match your genre (serif for literary, bold sans for thriller, script for romance). Use curated font libraries, not system defaults.
5. **Mistake 4: Wrong dimensions or resolution** — Pixelated covers from low-res sources. Wrong aspect ratio causing Amazon to crop awkwardly. Designing at 72 DPI then wondering why it looks blurry. **Fix:** Always work at 1600x2560 pixels, 300 DPI. This is KDP's recommended spec. Don't upscale from smaller images — start at full resolution.
6. **Mistake 5: Cluttered composition** — Too many elements competing for attention. Text, imagery, tagline, series badge, endorsement quote — all fighting for space. **Fix:** One focal point. Clear visual hierarchy: title > imagery > author name. Let the cover breathe. Whitespace isn't wasted space — it's what makes the important elements land.
7. **BookClad angle** (brief, natural) — Genre-aware attributes help you nail genre signals from the start. KDP-compliant export handles dimensions automatically. The canvas editor gives you precise typography control. And because AI generation avoids stock photos, your cover won't look like fifty other books.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/blog/book-cover-mistakes-that-kill-sales.mdx`

Expected: Valid YAML frontmatter with title, description, date, tags between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/blog/book-cover-mistakes-that-kill-sales.mdx
git commit -m "content: add book cover mistakes blog post"
```

---

## Task 5: Blog Post — How to Add Text to AI Covers

**Files:**
- Create: `content/blog/how-to-add-text-to-ai-book-cover.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "How to Add Text to Your AI-Generated Book Cover"
description: "A practical guide to adding titles, author names, and other text to AI-generated covers — from font choice to the bake technique."
date: "2026-03-27"
tags: ["typography", "tutorial", "cover-design"]
---
```

Content outline (1200-1500 words):
1. **Opening** — AI can generate stunning artwork, but text is where most AI covers fall apart. AI-generated text in images is unreliable — misspellings, warped letters, inconsistent styling. The solution: separate the art from the text, then combine them with control.
2. **Choosing fonts by genre** — Serif fonts (Garamond, Playfair Display) for literary fiction and historical. Bold sans-serif (Oswald, Bebas Neue) for thriller and action. Script and handwritten fonts for romance. Decorative display fonts for fantasy. Monospace or geometric for sci-fi. Rule of thumb: if your font choice surprises a reader of the genre, reconsider.
3. **Sizing for readability** — The title is the most important text element. It must be legible at Amazon thumbnail size (~300px wide). Author name is secondary — smaller, but still readable. Taglines and series info are optional — only include if they fit without cluttering. Test at thumbnail size before committing.
4. **Placement basics** — Top third or bottom third — rarely the middle (that's for the imagery). Title and author name on opposite ends creates natural hierarchy. Rule of thirds applies to cover design just like photography. Leave breathing room between text and edges. Consider how the text interacts with the background — a semi-transparent overlay or shadow can save text that would otherwise disappear into a busy background.
5. **The layer approach** — Add text as separate layers on top of the generated artwork. Each layer can be moved, resized, and styled independently. This gives you full control over positioning without affecting the art. You can try multiple typography options on the same artwork without regenerating.
6. **The bake technique** — For covers where you want text to feel like part of the artwork (embossed metal letters for fantasy, neon glow for sci-fi, hand-painted text for romance), "bake layers" uses AI to integrate your text into the image. Two styles: **Stylized** applies genre-appropriate effects, **Clean** blends the text simply without heavy effects. Bake is best for title text where you want creative integration. Keep author name as a standard text layer for clarity.
7. **BookClad walkthrough** — In the editor: add a text layer from the Layers section in the right sidebar → type your title → choose a font (built-in library organized by serif, sans-serif, display, monospace — or upload your own) → adjust size, color, position → optionally bake for AI-integrated text styling. Export produces a KDP-ready JPEG with all layers composited.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/blog/how-to-add-text-to-ai-book-cover.mdx`

Expected: Valid YAML frontmatter with title, description, date, tags between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/blog/how-to-add-text-to-ai-book-cover.mdx
git commit -m "content: add typography tutorial blog post"
```

---

## Task 6: Help Doc — Creating Your First Cover

**Files:**
- Create: `content/help/creating-your-first-cover.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "Creating Your First Cover"
description: "From sign-up to your first generated cover in under 5 minutes."
category: "Getting Started"
order: 1
---
```

Content outline (practical, step-by-step):
1. **Sign up** — Visit bookclad.com and sign in with Google, Apple, or Amazon. You get 15 free credits to start — enough for 5 single-image Quick-tier generations (3 credits each).
2. **Create a project** — Click "Create a Cover" from the dashboard. Give your project a name (usually your book title).
3. **Describe your book** — Write a brief description. Be specific: "A dark psychological thriller about a detective investigating disappearances in a remote fishing village" works much better than "thriller book."
4. **Set your attributes** — Select your genre, mood, art style, visual elements, and color palette. These guide the AI more precisely than a text description alone. Not sure what to pick? Use **AI Fill** — describe what you want in plain language and it suggests the right attribute combination (costs 1 credit).
5. **Choose your model tier** — **Quick** (3 credits/image): fast prototyping, lower resolution, not export-ready. Available on all plans. **Detailed** (5 credits/image): high quality, KDP-ready. Requires Starter plan or higher. Recommended for most users. **Premium** (10 credits/image): highest quality. Requires Starter plan or higher. Best for final covers.
6. **Generate** — Choose how many images to generate (1-8) and click Generate. Watch progress in the Queue tab at the bottom of the editor.
7. **Browse results** — Your generated images appear in the Generation History tab. Click any image to load it on the canvas.
8. **Add text** — Click "Add Text" in the Layers section of the right sidebar. Add your title and author name. Choose fonts, adjust size and position.
9. **Export** — Click "Export JPEG" or "Export PNG" in the right sidebar. The export is KDP-compliant: 1600x2560 pixels, 300 DPI. Upload directly to KDP.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/help/creating-your-first-cover.mdx`

Expected: Valid YAML frontmatter with title, description, category ("Getting Started"), order (1) between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/help/creating-your-first-cover.mdx
git commit -m "content: add getting started help doc"
```

---

## Task 7: Help Doc — Understanding Credits

**Files:**
- Create: `content/help/understanding-credits.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "Understanding Credits"
description: "How BookClad's credit system works — costs, tiers, and refunds."
category: "Getting Started"
order: 2
---
```

Content outline (clear, reference-style):
1. **What are credits?** — Credits are BookClad's currency for AI-powered features. Every generation, AI Fill, and AI Edit uses credits.
2. **Generation costs** (table format):
   | Tier | Credits per Image | Quality | Export-Ready? | Plan Required |
   |------|------------------|---------|---------------|---------------|
   | Quick | 3 | Good (prototyping) | No | Free |
   | Detailed | 5 | High (KDP-ready) | Yes | Starter+ |
   | Premium | 10 | Highest | Yes | Starter+ |
3. **Other costs** — AI Fill: 1 credit (suggests attribute combinations). AI Edit: 1 credit (AI-powered attribute config editing in Settings).
4. **Free credits** — Every new account gets 15 credits on signup. That's enough for 5 Quick-tier single-image generations or 3 Quick-tier multi-image generations. No credit card required.
5. **Subscription plans** (table format):
   | Plan | Monthly Credits | Price |
   |------|----------------|-------|
   | Free | 15 (one-time) | $0 |
   | Starter | 100/month | varies |
   | Pro | 250/month | varies |
   | Studio | 500/month | varies |
   Subscription credits reset monthly (no rollover).
6. **Credit packs** — One-time purchases for extra credits: 50, 100, 250, or 500 credits. Purchased credits expire after 12 months. Available on any plan.
7. **What happens when generation fails?** — If a generation fails, your credits are automatically refunded. If only some images in a batch succeed, you're refunded for the ones that didn't generate. You'll see the refund in your credit history.
8. **Checking your balance** — Your credit balance is always visible in the navigation bar. For detailed transaction history, go to Settings > Billing.
9. **Priority queue** — Pro and Studio subscribers get priority in the generation queue — your jobs are processed before Free and Starter tier users.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/help/understanding-credits.mdx`

Expected: Valid YAML frontmatter with title, description, category ("Getting Started"), order (2) between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/help/understanding-credits.mdx
git commit -m "content: add understanding credits help doc"
```

---

## Task 8: Help Doc — The Cover Editor

**Files:**
- Create: `content/help/the-cover-editor.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "The Cover Editor"
description: "Canvas, layers, text, and everything you can do in the editor."
category: "Using the Editor"
order: 3
---
```

Content outline (reference-style, organized by section):
1. **Editor layout** — Three panels: **Left sidebar** (attributes — genre, mood, style, etc.), **Center** (canvas with your cover), **Right sidebar** (layers, properties, export). Bottom panel has two tabs: **History** (past generations) and **Queue** (active generations with real-time progress).
2. **Working with generated images** — Click any image in Generation History to load it onto the canvas. You can switch between images freely — your text layers are preserved per image.
3. **Adding text** — Click "Add Text" in the Layers section of the right sidebar. A new text layer appears on the canvas. Click it to edit. Drag to reposition. Use handles to resize.
4. **Text properties** — Select a text layer to edit: font family, font size, color, alignment (left/center/right), letter spacing, and position coordinates. All changes are live on the canvas.
5. **Fonts** — Built-in font library organized by category: Serif, Sans-Serif, Display, and Monospace. Upload custom fonts (TTF/OTF) via the font picker — they're stored in your account and available across all projects.
6. **Layers** — The right sidebar shows all layers (images and text) in stack order. Drag to reorder. Toggle visibility with the eye icon. Click to select on canvas.
7. **Bake layers** — Integrates your text layers into the artwork using AI. Two modes: **Stylized** — applies genre-appropriate creative effects (embossed metal, neon glow, hand-painted, etc.). **Clean** — blends text into the image with minimal effects. Great for when text just needs to sit naturally in the composition. Bake uses a generation (costs credits based on your selected model tier). After baking, the text becomes part of the image.
8. **Generation history** — The bottom panel's History tab shows all generations for this project. Each generation displays the attribute settings used, with amber highlights showing what changed between generations. Click "Generate Similar" on any generation to create variations.
9. **Extending generations** — Want more variations from a generation you like? Click "Generate More" to add images to an existing generation without starting over. New images use the same attributes.
10. **Export** — Click "Export JPEG" or "Export PNG" in the right sidebar. Output is KDP-compliant: 1600x2560 pixels, 300 DPI. All text layers are composited into the final image. Only available for Detailed and Premium tier images (Quick tier is for prototyping and not export-ready).

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/help/the-cover-editor.mdx`

Expected: Valid YAML frontmatter with title, description, category ("Using the Editor"), order (3) between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/help/the-cover-editor.mdx
git commit -m "content: add cover editor help doc"
```

---

## Task 9: Help Doc — Tips for Better Results

**Files:**
- Create: `content/help/tips-for-better-results.mdx`

- [ ] **Step 1: Write the MDX file**

Frontmatter:
```yaml
---
title: "Tips for Better Results"
description: "How to get the most out of AI cover generation."
category: "Using the Editor"
order: 4
---
```

Content outline (tips format, actionable):
1. **Be specific in your description** — "Dark psychological thriller set in a crumbling Victorian mansion at dusk, with fog rolling through dead gardens" gives the AI much more to work with than "thriller book." Include setting, atmosphere, time of day, key visual elements.
2. **Use all your attributes** — Don't just set genre and call it done. Mood, art style, visual elements, and color palette each steer the output in meaningful ways. A "Thriller" with "Moody" mood and "Dark" palette produces very different results than "Thriller" with "Intense" mood and "High Contrast" palette.
3. **Start quick, then go detailed** — Use Quick tier (3 credits, available on Free plan) to rapidly explore different directions. Generate several batches with different attribute combinations. Once you find a direction you love, switch to Detailed (5 credits, requires Starter plan) for the final high-quality, export-ready version.
4. **Let AI Fill do the heavy lifting** — Not sure which attributes to pick? Click AI Fill, describe your book in plain language, and it suggests a complete attribute combination. Costs just 1 credit and often surfaces combinations you wouldn't think of.
5. **Use "Generate Similar" to iterate** — Found a cover that's 80% perfect? Don't start over. Click "Generate Similar" to create variations that keep the same creative direction while exploring different compositions and details.
6. **Extend instead of restarting** — If you like the direction of a generation but want more options, use "Generate More" to add images to the existing generation. This is cheaper than starting a fresh generation since you're adding to proven attributes.
7. **Bake for professional text** — For genre covers where styled text matters (fantasy, thriller, romance), use Bake Layers to have AI integrate your title into the artwork. Stylized mode adds genre-appropriate effects. This is what separates "text floating on top of art" from "text that belongs in the image."
8. **Experiment with color palettes** — Color has an outsized effect on mood and genre signaling. Try the same description with different palettes. Warm golds for romance, cold blues for thriller, jewel tones for fantasy. A palette change can completely transform a cover.
9. **Don't settle on generation one** — The magic of AI cover design is in iteration. Your first generation gives you a starting point. Your fifth gives you a cover. Expect to generate, adjust attributes, regenerate, tweak, and regenerate again. Each round gets closer.

- [ ] **Step 2: Verify MDX is valid**

Run: `head -10 content/help/tips-for-better-results.mdx`

Expected: Valid YAML frontmatter with title, description, category ("Using the Editor"), order (4) between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add content/help/tips-for-better-results.mdx
git commit -m "content: add tips for better results help doc"
```

---

## Task 10: Final verification and cleanup

- [ ] **Step 1: Verify all 9 files exist**

Run: `ls -la content/blog/*.mdx content/help/*.mdx`

Expected: 5 blog files + 4 help files.

- [ ] **Step 2: Delete .gitkeep files** (no longer needed)

```bash
rm -f content/blog/.gitkeep content/help/.gitkeep
```

- [ ] **Step 3: Verify dev server renders content** (manual step)

Run: `npm run dev` and manually check:
- `http://localhost:3000/blog` — should list all 5 posts
- `http://localhost:3000/help` — should show 2 categories ("Getting Started" with 2 docs, "Using the Editor" with 2 docs)
- Click into each post/doc to verify MDX renders correctly

Note: This step requires manual browser verification — skip if running as an automated agent.

- [ ] **Step 4: Commit cleanup**

```bash
git add -A content/
git commit -m "chore: remove .gitkeep files from content directories"
```
