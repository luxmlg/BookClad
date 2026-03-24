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

/** The first 3 covers are the hero fan covers. */
const FAN_COUNT = 3;

const FAN_ROTATIONS = [-6, 0, 6];
const FAN_SCALES = [0.92, 1, 0.92];
const FAN_X_OFFSETS = [20, 0, -20];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

// ---------------------------------------------------------------------------
// Fan phase: 3 fanned covers that unwind + 5 extras that fade in
// ---------------------------------------------------------------------------

function FanPhase({ progress }: { progress: number }) {
  // Unwind: 0→0.5 maps fan props to neutral
  const unwind = Math.min(1, progress / 0.5);
  // Spread: covers move apart 0.3→0.7
  const spread = Math.min(1, Math.max(0, (progress - 0.3) / 0.4));
  // Extra covers fade in 0.4→0.7
  const extraFade = Math.min(1, Math.max(0, (progress - 0.4) / 0.3));
  // Label fades in 0.6→0.85
  const labelFade = Math.min(1, Math.max(0, (progress - 0.6) / 0.25));

  const gapPx = lerp(-24, 12, spread);

  return (
    <div className="flex flex-col items-center">
      <p
        className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase"
        style={{ opacity: labelFade }}
      >
        Covers crafted by AI, tailored to your genre
      </p>

      <div className="flex items-center justify-center">
        {COVERS.map((cover, i) => {
          const isFan = i < FAN_COUNT;

          if (isFan) {
            const rotation = lerp(FAN_ROTATIONS[i], 0, unwind);
            const scale = lerp(FAN_SCALES[i], 1, unwind);
            const xOffset = lerp(FAN_X_OFFSETS[i], 0, unwind);

            return (
              <div
                key={cover.genre}
                className="relative"
                style={{
                  zIndex: i === 1 ? 20 : 10,
                  marginLeft: i === 0 ? 0 : gapPx,
                  transform: `rotate(${rotation}deg) scale(${scale}) translateX(${xOffset}px)`,
                  transition: "none",
                }}
              >
                <CoverImage
                  src={cover.image}
                  alt={`${cover.title} by ${cover.author}`}
                  priority
                />
              </div>
            );
          }

          // Extra covers (indices 3-7)
          return (
            <div
              key={cover.genre}
              className="relative"
              style={{
                opacity: extraFade,
                transform: `scale(${lerp(0.8, 1, extraFade)})`,
                marginLeft: gapPx,
                zIndex: 5,
              }}
            >
              <CoverImage
                src={cover.image}
                alt={`${cover.title} by ${cover.author}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverImage({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="relative aspect-[5/8] w-[120px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/10 sm:w-[140px] lg:w-[160px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="160px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel phase (interactive Embla carousel)
// ---------------------------------------------------------------------------

function CarouselPhase() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: 3000, stopOnInteraction: true })],
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

  return (
    <div className="flex flex-col items-center">
      <p className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Covers crafted by AI, tailored to your genre
      </p>

      <div className="relative w-full max-w-5xl">
        <div className="overflow-x-clip overflow-y-visible" ref={emblaRef}>
          <div className="-ml-4 flex py-4">
            {COVERS.map((cover, i) => {
              const isActive = i === selectedIndex;
              return (
                <div
                  key={cover.genre}
                  className="min-w-0 flex-[0_0_80%] pl-4 sm:flex-[0_0_33.333%]"
                >
                  <div
                    className={`transition-all duration-300 ${
                      isActive
                        ? "scale-105 opacity-100"
                        : "scale-[0.85] opacity-40 blur-[1px]"
                    }`}
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

        <button
          onClick={scrollPrev}
          aria-label="Previous cover"
          className="absolute -left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={scrollNext}
          aria-label="Next cover"
          className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex"
        >
          <ChevronRight className="size-5" />
        </button>

        <div className="mt-6 flex justify-center gap-2">
          {COVERS.map((cover, i) => (
            <button
              key={cover.genre}
              aria-label={`Go to ${cover.genre} cover`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`size-2 rounded-full transition-all ${
                i === selectedIndex
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {COVERS[selectedIndex].attributes.length > 0 && (
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
  );
}

// ---------------------------------------------------------------------------
// Main: scroll-pinned section that transitions fan → carousel
// ---------------------------------------------------------------------------

export function CoverShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const [progress, setProgress] = useState(0);
  const [showCarousel, setShowCarousel] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const p = Math.min(1, v / 0.6);
    setProgress(p);
    setShowCarousel(v > 0.55);
  });

  return (
    <section ref={containerRef} className="relative h-[200vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4">
        <div className="w-full max-w-5xl">
          {showCarousel ? (
            <CarouselPhase />
          ) : (
            <FanPhase progress={progress} />
          )}
        </div>
      </div>
    </section>
  );
}
