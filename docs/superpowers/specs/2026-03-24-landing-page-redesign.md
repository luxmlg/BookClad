# Landing Page Redesign

## Goal

Transform the BookClad landing page from placeholder mockups to a real product showcase with AI-generated covers, actual app screenshots, scroll animations, and updated feature text.

## Page Flow

```
Hero (heading + CTA + 3-cover fan)
  ↓
Carousel (8 real AI-generated covers with attribute badges)
  ↓
Product Showcase (4 alternating screenshot + text rows)
  ↓
Features (6 cards, 2 updated)
  ↓
Pricing (unchanged)
  ↓
Footer (unchanged)
```

---

## 1. Hero Section

**Existing:** Heading, subheading, CTA buttons, trust line. No imagery.

**Changes:**

- **3-cover fan** below the CTA buttons: 3 of the best carousel covers fanned out. Center cover straight, left tilted -6deg, right tilted +6deg. Center slightly larger/elevated. Layered with depth shadows.
- **Entrance animation** (Framer Motion): Badge (0ms) → heading (100ms) → subheading (200ms) → CTA buttons (300ms) → trust line (400ms) → covers fly in from below with stagger (500-700ms).
- **Floating animation** after entrance: covers gently bob up/down (3-4s cycle).
- **Mobile:** 3 covers stacked with slight overlap, smaller scale.

**Subheading update:**
> "Describe your story, choose a style, and get KDP-ready cover options in minutes. Fine-tune with typography, AI region editing, and one-click export."

(Removes hardcoded "4 cover options" count.)

---

## 2. Carousel

**Existing:** 6 CSS-gradient mock covers with hardcoded text.

**Changes:**

- **8 real AI-generated cover images** replacing CSS gradients. Stored in `public/landing/covers/cover-1.jpg` through `cover-8.jpg`.
- **Attribute badges on active cover:** Below the active Kindle frame, a row of small badges showing key attributes (genre, mood, art style). Fades in/out with `AnimatePresence` on slide change.
- **Cover data structure:** Each entry has `image`, `title`, `author`, `genre`, `attributes` (array of label strings).

**Carousel behavior unchanged:** Embla, autoplay 3s, loop, center-aligned. Active: scale 1.05, full opacity. Inactive: scale 0.85, 40% opacity, blur. Desktop: 3 visible. Mobile: 1 (80% width).

**The 8 covers:**

| # | Genre | Title | Author |
|---|-------|-------|--------|
| 1 | Thriller | The Last Witness | James Mercer |
| 2 | Romance | Where Peonies Bloom | Claire Fontaine |
| 3 | Fantasy | Crown of Embers | R.K. Ashwood |
| 4 | Sci-Fi | Neon Horizon | Dex Omari |
| 5 | Horror | Hollow Ground | M. Blackwell |
| 6 | Literary Fiction | The Weight of Small Things | Nora Chen |
| 7 | Self-Help | Atomic Focus | Dr. Lena Park |
| 8 | Mystery | The Vanishing Tide | Sable Drake |

Attribute data for each cover will be provided after generation.

---

## 3. Product Showcase (NEW)

**New section between Carousel and Features.** Alternating image + text rows.

**Section header:**
- Heading: "See It in Action"
- Subtitle: "From description to publish-ready cover in minutes."

**4 rows:**

1. **Quick Create** (image left, text right)
   - Icon: Sparkles
   - Heading: "Describe Your Book, Get Covers"
   - Text: "Enter your title, author, and a short description. Our AI picks the genre, mood, art style, and visual attributes — then generates covers in one click."
   - Screenshots: `create-light.png` / `create-dark.png`

2. **Editor** (image right, text left)
   - Icon: Layers
   - Heading: "A Full Canvas Editor"
   - Text: "Fine-tune every detail. Add title and author text with genre-matched fonts, adjust layers, and preview exactly how your cover will look on a Kindle."
   - Screenshots: `editor-light.png` / `editor-dark.png`

3. **Generation Results** (image left, text right)
   - Icon: Images
   - Heading: "Compare and Iterate"
   - Text: "Every generation is saved with its attributes. Browse your history, see what changed between versions, and pick the best result."
   - Screenshots: `results-light.png` / `results-dark.png`

4. **Canvas Close-up** (image right, text left)
   - Icon: Type
   - Heading: "Typography That Fits"
   - Text: "Add title, subtitle, and author name with built-in fonts organized by genre. Safe-zone guides keep your text where KDP expects it."
   - Screenshots: `canvas-light.png` / `canvas-dark.png`

**Theme-aware screenshots (`<ThemedImage>`):**
- Both light and dark images rendered, stacked with absolute positioning
- Active image: `opacity-100`, inactive: `opacity-0`
- `transition-opacity duration-300` for smooth 300ms crossfade on theme switch
- No flash, no layout shift

**Screenshot styling:** `rounded-xl`, `ring-1 ring-foreground/10`, `shadow-xl`.

**Responsive:** Desktop: side-by-side (image 60%, text 40%). Mobile: stacked vertically (image on top, text below), no alternating.

**Animation:** Each row fades in on scroll via `<FadeIn>` wrapper (Framer Motion `whileInView`).

---

## 4. Features Section

**Existing:** 6 cards in 3-column grid.

**Changes to card text only (2 cards):**

Card #5 (replaces "Multiple AI Models"):
- **AI-Powered Quick Create** (Wand icon)
- "Describe your book and get covers in one click. Our AI analyzes your description and automatically selects genre, mood, art style, and visual attributes — no design decisions needed."

Card #6 (replaces "Compliance Checker"):
- **Generation History** (History icon)
- "Every generation is saved with its attributes. Compare results side-by-side, see what changed, and revert to any previous version."

Cards 1-4 unchanged. Grid layout unchanged.

**Animation:** Cards fade in on scroll with staggered 150ms delays between each.

---

## 5. Pricing & Footer

No changes. Pricing section and footer remain as-is.

---

## 6. Animation System

**New dependency:** `motion` (Framer Motion lightweight package).

**Reusable components:**

- `<FadeIn>` — Wrapper using `motion.div` with `whileInView={{ opacity: 1, y: 0 }}`, `initial={{ opacity: 0, y: 20 }}`, `viewport={{ once: true }}`. Accepts optional `delay` and `duration` props.
- `<ThemedImage>` — Renders both light/dark images stacked, crossfades based on current theme from `next-themes`. 300ms opacity transition.

**Animation locations:**
- Hero: staggered entrance on mount (text + cover fan fly-in + float)
- Carousel: `AnimatePresence` for attribute badge transitions
- Showcase rows: `<FadeIn>` on scroll
- Feature cards: `<FadeIn>` with staggered delays
- Pricing cards: `<FadeIn>` with staggered delays

---

## 7. Assets Required (User-Provided)

**Cover images (8):**
```
public/landing/covers/cover-1.jpg through cover-8.jpg
```

**Screenshots (8 = 4 scenes x 2 themes):**
```
public/landing/editor-light.png     public/landing/editor-dark.png
public/landing/create-light.png     public/landing/create-dark.png
public/landing/results-light.png    public/landing/results-dark.png
public/landing/canvas-light.png     public/landing/canvas-dark.png
```

**Attribute data:** Genre, mood, art style labels for each of the 8 covers (provided after generation).

---

## 8. New Components

| Component | File | Purpose |
|-----------|------|---------|
| `FadeIn` | `src/components/landing/fade-in.tsx` | Reusable scroll-triggered animation wrapper |
| `ThemedImage` | `src/components/landing/themed-image.tsx` | Crossfade between light/dark screenshots |
| `ProductShowcase` | `src/components/landing/product-showcase.tsx` | 4 alternating screenshot + text rows |
| `HeroCoverFan` | `src/components/landing/hero-cover-fan.tsx` | 3 fanned covers with entrance + float animation |

**Modified:**
| File | Change |
|------|--------|
| `src/app/page.tsx` | New page flow, updated hero text, feature cards text, showcase section |
| `src/components/landing/cover-carousel.tsx` | Real images, attribute badges, updated data structure |
