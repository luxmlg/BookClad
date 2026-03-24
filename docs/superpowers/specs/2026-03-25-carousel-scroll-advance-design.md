# Carousel Scroll-Advance Design

## Goal

After the fan-to-carousel transition completes, one additional slide advance should be triggered by continued scrolling before the page resumes normal scroll behavior.

## Context

`CoverShowcase` in `src/components/landing/cover-showcase.tsx` currently:
- Uses `window.scrollY` to drive a fan-to-carousel transition (progress 0→1 over scroll range 100-400px)
- The carousel is inside a sticky container (`sticky top-[3.5rem]`) within an outer div sized at `h-[105vh]`
- After `done` (progress >= 0.95), Embla autoplay starts and drag is enabled
- Once the outer container scrolls past, the sticky releases and the page continues

## Problem

After the fan transition completes, the sticky releases too quickly. There's no moment for the carousel to "breathe" and show that it's interactive. The user scrolls through the transition and immediately into the next section.

## Design

### Approach: Scroll-distance trigger

Extend the sticky scroll runway and use the existing `window.scrollY` listener to trigger one `emblaApi.scrollNext()` call at a threshold past the transition's end.

### Constants

- `ADVANCE_SCROLL_Y = 500` — the `window.scrollY` value at which `scrollNext()` fires
- `ADVANCE_RESET_Y = 400` — scrolling back above this resets the guard (matches the fan transition end, provides hysteresis to prevent flickering near the threshold)

### Changes (single file: `cover-showcase.tsx`)

1. **Increase outer container height** from `h-[105vh]` to `h-[115vh]` — adds ~10vh of extra scroll runway while the carousel stays sticky-pinned

2. **Add a ref guard** (`hasAdvancedRef = useRef(false)`) to ensure the slide advance fires exactly once

3. **Store `emblaApi` in a ref** (`emblaApiRef`) updated via `useEffect` so the scroll handler (which has `[]` deps) can access the current Embla instance without stale closures

4. **Extend the existing `onScroll` handler** — after setting progress, check: if `scrollY >= ADVANCE_SCROLL_Y` and guard is false, call `emblaApiRef.current.scrollNext()` and set guard true. If `scrollY < ADVANCE_RESET_Y`, reset guard to false (allows re-triggering if user scrolls back up and down again)

### What stays the same

- Fan transition logic (progress 0→1, per-slide interpolation)
- Embla autoplay (still starts after done)
- Arrow/dot controls
- Drag behavior
- All other carousel styling and behavior

### Scroll timeline

| Scroll range | Behavior |
|---|---|
| 0-100px | Hero scrolls normally |
| 100-400px | Carousel sticky-pinned, fan→carousel transition |
| 400-500px | Carousel still pinned, `scrollNext()` fires at `scrollY=500` |
| Past 500px | Sticky holds briefly, then releases as outer container scrolls past (viewport-height dependent) |

### Constraints

- No wheel event interception or `preventDefault`
- No new dependencies
- Works with all input types (mouse wheel, trackpad, touch)
