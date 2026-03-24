"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

const COVERS = [
  { image: "/landing/covers/cover-1.jpg", genre: "Thriller", title: "The Last Witness", author: "James Mercer", attributes: [] as string[] },
  { image: "/landing/covers/cover-4.jpg", genre: "Sci-Fi", title: "Neon Horizon", author: "Dex Omari", attributes: [] as string[] },
  { image: "/landing/covers/cover-2.jpg", genre: "Romance", title: "Where Peonies Bloom", author: "Claire Fontaine", attributes: [] as string[] },
  { image: "/landing/covers/cover-3.jpg", genre: "Fantasy", title: "Crown of Embers", author: "R.K. Ashwood", attributes: [] as string[] },
  { image: "/landing/covers/cover-5.jpg", genre: "Horror", title: "Hollow Ground", author: "M. Blackwell", attributes: [] as string[] },
  { image: "/landing/covers/cover-6.jpg", genre: "Literary Fiction", title: "The Weight of Small Things", author: "Nora Chen", attributes: [] as string[] },
  { image: "/landing/covers/cover-7.jpg", genre: "Self-Help", title: "Atomic Focus", author: "Dr. Lena Park", attributes: [] as string[] },
  { image: "/landing/covers/cover-8.jpg", genre: "Mystery", title: "The Vanishing Tide", author: "Sable Drake", attributes: [] as string[] },
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

// Fan properties for slides 0, 1, 2
const FAN_ROTATION = [-6, 0, 6];
const FAN_SCALE = [0.92, 1, 0.92];
const FAN_TRANSLATE_X = [40, 0, -40]; // px — brings covers together for overlap

/**
 * Compute per-slide CSS for smooth fan → carousel interpolation.
 * At progress=0: fan layout (3 centered, rotated, overlapping).
 * At progress=1: carousel layout (center active, sides dimmed).
 */
function getSlideStyle(index: number, progress: number) {
  const isFan = index < 3;
  const isCenter = index === 1;

  if (isFan) {
    // Carousel end-state for this slide
    const endScale = isCenter ? 1.05 : 0.85;
    const endOpacity = isCenter ? 1 : 0.4;
    const endBlur = isCenter ? 0 : 1;

    const rotation = lerp(FAN_ROTATION[index], 0, progress);
    const scale = lerp(FAN_SCALE[index], endScale, progress);
    const tx = lerp(FAN_TRANSLATE_X[index], 0, progress);
    const opacity = lerp(1, endOpacity, progress);
    const blur = lerp(0, endBlur, progress);

    return {
      transform: `translateX(${tx}px) rotate(${rotation}deg) scale(${scale})`,
      opacity,
      filter: blur > 0.01 ? `blur(${blur}px)` : "none",
      zIndex: isCenter ? 20 : 10,
    };
  }

  // Non-fan slides: stay invisible during transition.
  // They appear only when done=true and Embla classes take over with overflow-x-clip.
  return {
    transform: "scale(0.85)",
    opacity: 0,
    filter: "none",
    zIndex: 5,
  };
}

export function CoverShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const done = progress >= 0.95;

  // Window scroll → progress (0 at page top, 1 after 400px scroll)
  useEffect(() => {
    function onScroll() {
      setProgress(clamp01((window.scrollY - 100) / 300));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Embla — always mounted, startIndex=1 so center fan cover is selected
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", startIndex: 1, watchDrag: done },
    [Autoplay({ delay: 3000, stopOnInteraction: true, playOnInit: false })],
  );
  const [selectedIndex, setSelectedIndex] = useState(1);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Enable autoplay + drag when transition completes
  useEffect(() => {
    if (!emblaApi) return;
    if (done) emblaApi.plugins().autoplay?.play();
    else emblaApi.plugins().autoplay?.stop();
  }, [emblaApi, done]);

  useEffect(() => {
    emblaApi?.reInit({ watchDrag: done });
  }, [emblaApi, done]);

  const labelOpacity = clamp01((progress - 0.5) / 0.3);
  const controlsOpacity = clamp01((progress - 0.7) / 0.25);

  return (
    <div ref={containerRef} className="relative mt-10 h-[105vh]">
      <div className="sticky top-[3.5rem] pt-4">
        <div className="mx-auto max-w-5xl px-4">
          {/* Label */}
          <p
            className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase"
            style={{ opacity: labelOpacity }}
          >
            Covers crafted by AI, tailored to your genre
          </p>

          {/* Single Embla carousel with per-slide transform interpolation */}
          <div className="relative">
            <div
              ref={emblaRef}
              className={done ? "overflow-x-clip overflow-y-visible" : "overflow-visible"}
            >
              <div className="-ml-4 flex py-4">
                {COVERS.map((cover, i) => {
                  // During transition: interpolated style. After: Embla handles it.
                  const s = done ? null : getSlideStyle(i, progress);
                  const isActive = done && i === selectedIndex;

                  return (
                    <div
                      key={cover.genre}
                      className="min-w-0 flex-[0_0_80%] pl-4 sm:flex-[0_0_33.333%]"
                      style={s ? { opacity: s.opacity, zIndex: s.zIndex } : undefined}
                    >
                      <div
                        style={s ? { transform: s.transform, filter: s.filter } : undefined}
                        className={
                          done
                            ? `transition-all duration-300 ${
                                isActive
                                  ? "scale-105 opacity-100"
                                  : "scale-[0.85] opacity-40 blur-[1px]"
                              }`
                            : ""
                        }
                      >
                        <div
                          className={`mx-auto max-w-[220px] sm:max-w-[240px] ${
                            isActive
                              ? "rounded-2xl border-[3px] border-zinc-800 bg-zinc-800 p-1 pb-4 shadow-[0_0_40px_-10px_oklch(0.4_0_0/0.4)] dark:border-zinc-600 dark:bg-zinc-700 dark:shadow-[0_0_40px_-10px_oklch(0.9_0_0/0.15)]"
                              : ""
                          }`}
                        >
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
                          {isActive && (
                            <div className="mt-1.5 flex justify-center">
                              <div className="size-3 rounded-full border border-zinc-600 dark:border-zinc-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Arrows */}
            <button
              onClick={scrollPrev}
              aria-label="Previous cover"
              className="absolute -left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
              style={{ opacity: controlsOpacity, pointerEvents: done ? "auto" : "none" }}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-label="Next cover"
              className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
              style={{ opacity: controlsOpacity, pointerEvents: done ? "auto" : "none" }}
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Dots */}
            <div className="mt-6 flex justify-center gap-2" style={{ opacity: controlsOpacity }}>
              {COVERS.map((cover, i) => (
                <button
                  key={cover.genre}
                  aria-label={`Go to ${cover.genre} cover`}
                  onClick={() => done && emblaApi?.scrollTo(i)}
                  className={`size-2 rounded-full transition-all ${
                    done && i === selectedIndex
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>

            {/* Attribute badges */}
            <AnimatePresence mode="wait">
              {done && COVERS[selectedIndex].attributes.length > 0 && (
                <motion.div
                  key={selectedIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
                >
                  {COVERS[selectedIndex].attributes.map((attr) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
