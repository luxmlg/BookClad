"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  AnimatePresence,
} from "motion/react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

const COVERS = [
  {
    image: "/landing/covers/cover-1.jpg",
    genre: "Thriller",
    title: "The Last Witness",
    author: "James Mercer",
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

// Fan config for first 3 slides
const FAN_ROTATIONS = [-6, 0, 6];
const FAN_SCALES = [0.92, 1, 0.92];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Compute per-slide style overrides based on scroll progress.
 * At progress=0: slides 0-2 are fanned, slides 3-7 are invisible.
 * At progress=1: all slides at identity (normal carousel appearance).
 */
function getSlideStyle(index: number, progress: number) {
  const isFan = index < 3;
  // Phase timings
  const unwind = clamp01(progress / 0.4); // 0→0.4: fan unwinds
  const extraFade = clamp01((progress - 0.3) / 0.3); // 0.3→0.6: extras appear

  if (isFan) {
    const rotation = lerp(FAN_ROTATIONS[index], 0, unwind);
    const scale = lerp(FAN_SCALES[index], 1, unwind);
    return {
      transform: `rotate(${rotation}deg) scale(${scale})`,
      opacity: 1,
      zIndex: index === 1 ? 20 : 10,
    };
  }

  // Extra slides: fade in
  return {
    transform: `scale(${lerp(0.85, 1, extraFade)})`,
    opacity: extraFade,
    zIndex: 5,
  };
}

export function CoverShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const [progress, setProgress] = useState(0);
  const transitionDone = progress >= 0.95;

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setProgress(Math.min(1, v / 0.6));
  });

  // Embla carousel — always mounted
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
      watchDrag: transitionDone, // disable drag until transition completes
    },
    [Autoplay({ delay: 3000, stopOnInteraction: true, playOnInit: false })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Start autoplay when transition completes
  useEffect(() => {
    if (!emblaApi) return;
    if (transitionDone) {
      emblaApi.plugins().autoplay?.play();
    } else {
      emblaApi.plugins().autoplay?.stop();
    }
  }, [emblaApi, transitionDone]);

  // Rerender Embla when watchDrag changes
  useEffect(() => {
    emblaApi?.reInit({ watchDrag: transitionDone });
  }, [emblaApi, transitionDone]);

  // UI element visibility driven by progress
  const labelOpacity = clamp01((progress - 0.5) / 0.2);
  const controlsOpacity = clamp01((progress - 0.7) / 0.2);

  return (
    <section ref={containerRef} className="relative h-[250vh]">
      <div className="sticky top-[3.5rem] flex h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden">
        <div className="w-full max-w-5xl px-4">
          {/* Label */}
          <div className="mb-8 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" style={{ opacity: labelOpacity }} />
          <p
            className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase"
            style={{ opacity: labelOpacity }}
          >
            Covers crafted by AI, tailored to your genre
          </p>

          {/* Carousel — always mounted, transforms overlaid */}
          <div className="relative">
            <div className="overflow-x-clip overflow-y-visible" ref={emblaRef}>
              <div className="-ml-4 flex py-4">
                {COVERS.map((cover, i) => {
                  const slideStyle = getSlideStyle(i, progress);
                  const isActive = transitionDone && i === selectedIndex;

                  return (
                    <div
                      key={cover.genre}
                      className="min-w-0 flex-[0_0_80%] pl-4 sm:flex-[0_0_33.333%]"
                      style={{
                        opacity: slideStyle.opacity,
                        zIndex: transitionDone ? undefined : slideStyle.zIndex,
                      }}
                    >
                      <div
                        style={{
                          transform: transitionDone ? undefined : slideStyle.transform,
                        }}
                        className={
                          transitionDone
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

            {/* Arrows — visible after transition */}
            <button
              onClick={scrollPrev}
              aria-label="Previous cover"
              className="absolute -left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
              style={{ opacity: controlsOpacity, pointerEvents: transitionDone ? "auto" : "none" }}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-label="Next cover"
              className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
              style={{ opacity: controlsOpacity, pointerEvents: transitionDone ? "auto" : "none" }}
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Dots — visible after transition */}
            <div
              className="mt-6 flex justify-center gap-2"
              style={{ opacity: controlsOpacity }}
            >
              {COVERS.map((cover, i) => (
                <button
                  key={cover.genre}
                  aria-label={`Go to ${cover.genre} cover`}
                  onClick={() => transitionDone && emblaApi?.scrollTo(i)}
                  className={`size-2 rounded-full transition-all ${
                    transitionDone && i === selectedIndex
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>

            {/* Attribute badges */}
            <AnimatePresence mode="wait">
              {transitionDone &&
                COVERS[selectedIndex].attributes.length > 0 && (
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
    </section>
  );
}
