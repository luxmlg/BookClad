# BookClad Content Strategy: Blog Posts & Help Docs

## Overview

Initial content batch for BookClad — 5 blog posts (SEO-first) and 4 help docs (onboarding-focused). Blog posts target real search queries indie authors have and naturally feature BookClad as the solution. Help docs provide practical reference material for new users.

## Audience

Mix of complete beginners to self-publishing and experienced indie authors who already use cover design tools. Content serves both by leading with universal cover design knowledge and layering in BookClad-specific workflows.

## Tone

Friendly and practical — casual but knowledgeable, like advice from someone who's actually published books. Not corporate, not overly casual.

## Strategy

Hybrid SEO + product-led content. Blog posts target high-search-volume keywords that indie authors actually Google, while naturally demonstrating how BookClad solves each problem. Not forced promotion — genuinely useful content where BookClad is the natural tool.

## Deliverables

Full MDX files ready to drop into `content/blog/` and `content/help/`. Author writes, reviews, and tweaks before publishing.

## Technical Details

- Blog frontmatter: `title`, `description`, `date`, `tags`, `image?`
- Help frontmatter: `title`, `description`, `category`, `order`
- Format: MDX files in `content/blog/` and `content/help/` (directories already exist)
- Rendering: `next-mdx-remote/rsc` with custom components from `src/components/mdx-components.tsx`
- Auto-included in sitemap via `src/app/sitemap.ts`
- Help doc `category` strings must be spelled consistently across all docs (they are used as-is for grouping)
- Available MDX components: check `src/components/mdx-components.tsx` for custom elements (callouts, code blocks, etc.)

## Images & Screenshots

Screenshots of BookClad are deferred for now — the user will provide them separately. Blog posts and help docs should be written with placeholder guidance for where images would go (e.g., "[Screenshot: editor with text layers]") so images can be added later. The `image` frontmatter field on blog posts is optional and can be added when screenshots are ready.

---

## Blog Posts

### 1. Amazon KDP Book Cover Requirements: The Complete Guide for 2026

- **File**: `content/blog/amazon-kdp-cover-requirements-2026.mdx`
- **SEO targets**: "KDP cover requirements", "KDP cover dimensions", "kindle cover size"
- **Tags**: `kdp`, `cover-requirements`, `self-publishing`
- **Description**: Everything you need to know about Amazon KDP cover specs — dimensions, DPI, file format, and how to get them right every time.
- **Outline**:
  1. Why cover specs matter (rejection, quality)
  2. Exact dimensions: 1600x2560px, 300 DPI, JPEG
  3. Aspect ratio: 5:8 (not 9:16, not 2:3)
  4. File size limits (50MB max), format requirements, JPEG quality (92)
  5. Common mistakes (wrong DPI, RGB vs CMYK for print, bleed for paperback)
  6. BookClad angle: KDP dimensions are built in — generation, cropping, and export all target 1600x2560 automatically. No manual resizing or Photoshop needed.
- **Word count target**: 1200-1500 words

### 2. Book Cover Design Trends by Genre: What's Selling in 2026

- **File**: `content/blog/book-cover-design-trends-by-genre-2026.mdx`
- **SEO targets**: "book cover design trends", "romance cover design", "thriller book cover", "fantasy cover design"
- **Tags**: `cover-design`, `genre-trends`, `self-publishing`
- **Description**: A visual breakdown of what's working on bestseller lists across romance, thriller, fantasy, sci-fi, and literary fiction — and how to apply these trends to your cover.
- **Outline**:
  1. Why genre signaling matters (readers judge in <1 second)
  2. Romance: warm palettes, illustrated couples, script fonts
  3. Thriller/Mystery: dark tones, bold sans-serif, high contrast
  4. Fantasy: rich detail, ornate typography, jewel tones
  5. Sci-fi: minimalist, geometric, cool blues/teals
  6. Literary fiction: restrained, serif fonts, conceptual imagery
  7. BookClad angle: the attribute system (genre, mood, art style, color palette) lets you dial into these trends directly. AI Fill can suggest the right combination for your specific book.
- **Writer note**: Keep this post focused on external market trends (what's selling on bestseller lists). Help Doc 4 ("Tips for Better Results") covers how-to attribute advice — avoid duplicating that here.
- **Word count target**: 1500-1800 words

### 3. AI Book Cover Design: What Actually Works (and What Doesn't)

- **File**: `content/blog/ai-book-cover-design-what-works.mdx`
- **SEO targets**: "AI book cover design", "AI cover generator", "AI book cover"
- **Tags**: `ai-design`, `cover-design`, `tools`
- **Description**: An honest look at AI-generated book covers — where they excel, where they fall short, and how to get professional results.
- **Outline**:
  1. The state of AI cover design in 2026
  2. Where AI excels: concept exploration, iteration speed, cost efficiency, style consistency
  3. Where AI struggles: very specific compositions, photorealistic hands/faces, exact text rendering
  4. The key insight: AI is best as a creative partner, not a one-click solution
  5. How to get better results: be specific with descriptions, use structured attributes over free-text, iterate in tiers (Quick is available to all users for exploration; Detailed/Premium require a Starter subscription or higher for final-quality output)
  6. The text problem and how to solve it: generate the artwork, then add typography with a proper editor, or use bake layers to integrate text into the art
  7. BookClad angle: attribute system for structured input, three model tiers for different stages, canvas editor for typography, bake layers for text integration
- **Word count target**: 1500-1800 words

### 4. 5 Book Cover Mistakes That Kill Sales (and How to Fix Them)

- **File**: `content/blog/book-cover-mistakes-that-kill-sales.mdx`
- **SEO targets**: "book cover mistakes", "book cover design tips", "why my book isn't selling"
- **Tags**: `cover-design`, `self-publishing`, `tips`
- **Description**: The most common cover design mistakes self-published authors make — and practical fixes for each one.
- **Outline**:
  1. Mistake: Wrong genre signals (romance cover on a thriller)
     - Fix: Study your genre's visual language, use genre-specific attributes
  2. Mistake: Illegible at thumbnail size (text too small, low contrast)
     - Fix: Design for the thumbnail first, test at 300px wide
  3. Mistake: Amateur typography (too many fonts, poor spacing, default fonts)
     - Fix: Max 2 fonts, generous spacing, curated font libraries
  4. Mistake: Wrong dimensions or resolution (pixelated, wrong aspect ratio)
     - Fix: Always target 1600x2560 at 300 DPI
  5. Mistake: Cluttered composition (too many elements competing)
     - Fix: One focal point, clean hierarchy, let the cover breathe
  6. BookClad angle: genre-aware attributes prevent genre mismatch, KDP-compliant export handles dimensions, canvas editor gives typography control, AI generation avoids the "stock photo" look
- **Word count target**: 1200-1500 words

### 5. How to Add Text to Your AI-Generated Book Cover

- **File**: `content/blog/how-to-add-text-to-ai-book-cover.mdx`
- **SEO targets**: "book cover typography", "add text to book cover", "book title design"
- **Tags**: `typography`, `tutorial`, `cover-design`
- **Description**: A practical guide to adding titles, author names, and other text to AI-generated covers — from font choice to the bake technique.
- **Outline**:
  1. Why text is the hardest part of AI covers
  2. Choosing fonts by genre (serif for literary, bold sans for thriller, script for romance)
  3. Sizing for readability: title must be legible at thumbnail size
  4. Placement basics: rule of thirds, top/bottom anchoring, breathing room
  5. The layer approach: add text as separate layers, adjust independently
  6. The bake technique: when you want text integrated into the artwork (embossed, glowing, genre-styled), use bake layers to have AI blend it in
  7. BookClad angle: step-by-step walkthrough of adding text in the canvas editor, choosing from built-in fonts or uploading custom, using bake layers with style options (stylized vs clean)
- **Word count target**: 1200-1500 words

---

## Help Docs

### 1. Creating Your First Cover

- **File**: `content/help/creating-your-first-cover.mdx`
- **Category**: Getting Started
- **Order**: 1
- **Description**: From sign-up to your first generated cover in under 5 minutes.
- **Outline**:
  1. Create your account (Google, Apple, or Amazon sign-in)
  2. Click "Create a Cover" from the dashboard
  3. Describe your book (title, brief description)
  4. Select attributes: genre, mood, art style, visual elements, color palette
  5. Choose a model tier:
     - Quick (3 credits): fast prototyping, lower resolution, not export-ready — available on all plans including Free
     - Detailed (5 credits): high quality, KDP-ready, recommended for most users — requires Starter subscription or higher
     - Premium (10 credits): highest quality, best for final covers — requires Starter subscription or higher
  6. Click Generate and wait for results
  7. Browse your generated images, pick your favorite
  8. Add text (title, author name) in the canvas editor
  9. Export your KDP-ready cover

### 2. Understanding Credits

- **File**: `content/help/understanding-credits.mdx`
- **Category**: Getting Started
- **Order**: 2
- **Description**: How BookClad's credit system works — costs, tiers, and refunds.
- **Outline**:
  1. What credits are (BookClad's currency for AI generation)
  2. Per-image costs: Quick (3), Detailed (5), Premium (10)
  3. Free tier: 15 credits on signup — enough for 5 Quick generations (3 credits each) to try it out
  4. Subscription tiers: Starter (100/mo), Pro (250/mo), Studio (500/mo)
  5. Credit packs: one-time purchases (50, 100, 250, 500 credits) for flexible usage
  6. What happens when something goes wrong: automatic refund if generation fails
  7. AI Fill and AI Edit each cost 1 credit
  8. Check your balance: always visible in the top nav
  9. Manage billing: Settings > Billing tab

### 3. The Cover Editor

- **File**: `content/help/the-cover-editor.mdx`
- **Category**: Using the Editor
- **Order**: 3
- **Description**: Canvas, layers, text, and everything you can do in the editor.
- **Outline**:
  1. Editor layout: left sidebar (attributes), center (canvas), right sidebar (layers/properties/export)
  2. Switching between generated images
  3. Adding text layers: click "Add Text" in the Layers section of the right sidebar
  4. Editing text: font, size, color, alignment, position
  5. Font options: built-in fonts by category (serif, sans-serif, display, monospace) + custom font upload
  6. Layer ordering: drag to reorder, hide/show layers
  7. Bake layers: integrates text into the artwork using AI
     - Stylized: genre-appropriate effects (embossed, glowing, etc.)
     - Clean: simple blending, preserves text as-is
  8. Generation history: bottom panel shows all generations with attribute diffs
  9. Generate more: extend a generation to add more variations
  10. Export: click "Export JPEG" or "Export PNG" in the right sidebar for KDP-ready output (1600x2560, 300 DPI)

### 4. Tips for Better Results

- **File**: `content/help/tips-for-better-results.mdx`
- **Category**: Using the Editor
- **Order**: 4
- **Description**: How to get the most out of AI cover generation.
- **Outline**:
  1. Be specific in your book description — "dark psychological thriller set in a crumbling Victorian mansion" beats "thriller book"
  2. Use multiple attributes, not just genre — mood, art style, and color palette all steer the output significantly
  3. Start with Quick tier to explore directions (3 credits, available on Free plan), then upgrade to a Starter plan and switch to Detailed for your finals (5 credits)
  4. Use AI Fill: describe what you want in plain language, and it suggests attribute combinations
  5. Iterate with "Generate Similar": found a cover you almost love? Generate similar to get variations
  6. Extend generations: add more images to an existing generation without starting over
  7. Use bake layers for professional text integration — especially for genre covers where styled text matters
  8. Try different color palettes — they have an outsized effect on mood and genre signaling
  9. Don't settle on the first generation — the magic is in iteration
