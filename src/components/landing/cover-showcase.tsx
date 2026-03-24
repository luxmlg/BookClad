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

const FAN = [
  { src: COVERS[0].image, rotate: -6, x: 20, scale: 0.92, z: 10 },
  { src: COVERS[1].image, rotate: 0, x: 0, scale: 1, z: 20 },
  { src: COVERS[2].image, rotate: 6, x: -20, scale: 0.92, z: 10 },
];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Fan: 3 covers, fanned with entrance + float animation
// ---------------------------------------------------------------------------

function FanLayer() {
  return (
    <div className="flex items-center justify-center py-4">
      {FAN.map((cover, i) => (
        <motion.div
          key={i}
          className="relative"
          style={{ zIndex: cover.z, marginLeft: i === 0 ? 0 : -24 }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 + i * 0.1, ease: "easeOut" }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            style={{ rotate: cover.rotate, scale: cover.scale, x: cover.x }}
          >
            <div className="relative aspect-[5/8] w-[160px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/10 sm:w-[180px] lg:w-[200px]">
              <Image src={cover.src} alt="" fill sizes="200px" className="object-cover" priority />
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel: full 8-cover Embla carousel
// ---------------------------------------------------------------------------

function CarouselLayer({ active }: { active: boolean }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
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
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    if (active) emblaApi.plugins().autoplay?.play();
    else emblaApi.plugins().autoplay?.stop();
  }, [emblaApi, active]);

  return (
    <>
      <p className="mb-8 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Covers crafted by AI, tailored to your genre
      </p>

      <div className="relative">
        <div className="overflow-x-clip overflow-y-visible" ref={emblaRef}>
          <div className="-ml-4 flex py-4">
            {COVERS.map((cover, i) => {
              const isActive = active && i === selectedIndex;
              return (
                <div key={cover.genre} className="min-w-0 flex-[0_0_80%] pl-4 sm:flex-[0_0_33.333%]">
                  <div className={`transition-all duration-300 ${isActive ? "scale-105 opacity-100" : "scale-[0.85] opacity-40 blur-[1px]"}`}>
                    <div className={`mx-auto max-w-[220px] sm:max-w-[240px] ${isActive ? "rounded-2xl border-[3px] border-zinc-800 bg-zinc-800 p-1 pb-4 shadow-[0_0_40px_-10px_oklch(0.4_0_0/0.4)] dark:border-zinc-600 dark:bg-zinc-700 dark:shadow-[0_0_40px_-10px_oklch(0.9_0_0/0.15)]" : ""}`}>
                      <div className={`relative aspect-[5/8] overflow-hidden ${isActive ? "rounded-xl" : "rounded-xl shadow-xl"}`}>
                        <Image src={cover.image} alt={`${cover.title} by ${cover.author}`} fill sizes="240px" className="object-cover" priority={i <= 2} />
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

        <button onClick={scrollPrev} aria-label="Previous cover" className="absolute -left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex">
          <ChevronLeft className="size-5" />
        </button>
        <button onClick={scrollNext} aria-label="Next cover" className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background p-2.5 shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent sm:flex">
          <ChevronRight className="size-5" />
        </button>

        <div className="mt-6 flex justify-center gap-2">
          {COVERS.map((cover, i) => (
            <button key={cover.genre} aria-label={`Go to ${cover.genre} cover`} onClick={() => active && emblaApi?.scrollTo(i)} className={`size-2 rounded-full transition-all ${active && i === selectedIndex ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {active && COVERS[selectedIndex].attributes.length > 0 && (
            <motion.div key={selectedIndex} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {COVERS[selectedIndex].attributes.map((attr) => (
                <span key={attr} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{attr}</span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main: window.scrollY-driven crossfade (no container-relative offsets)
// ---------------------------------------------------------------------------

export function CoverShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      // Transition starts after 100px of scroll, completes at 400px
      setProgress(clamp01((window.scrollY - 100) / 300));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fanOpacity = 1 - progress;
  const carouselOpacity = progress;
  const carouselActive = carouselOpacity > 0.9;

  return (
    <div ref={containerRef} className="relative mt-10 min-h-[80vh]">
      <div className="sticky top-[3.5rem]">
        <div className="relative mx-auto max-w-5xl px-4">
          {/* Fan layer — visible on load, fades out on scroll */}
          <div
            className="absolute inset-x-0 top-0 z-10"
            style={{
              opacity: fanOpacity,
              pointerEvents: fanOpacity > 0.5 ? "auto" : "none",
              transition: "opacity 0.15s ease",
              display: fanOpacity < 0.01 ? "none" : undefined,
            }}
          >
            <FanLayer />
          </div>

          {/* Carousel layer — fades in on scroll */}
          <div
            style={{
              opacity: carouselOpacity,
              pointerEvents: carouselActive ? "auto" : "none",
              transition: "opacity 0.15s ease",
              visibility: carouselOpacity < 0.01 ? "hidden" : "visible",
            }}
          >
            <CarouselLayer active={carouselActive} />
          </div>
        </div>
      </div>
    </div>
  );
}
