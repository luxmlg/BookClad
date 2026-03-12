"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

const covers = [
  {
    genre: "Thriller",
    title: "The Last Witness",
    author: "James Mercer",
    gradient: "from-slate-900 via-red-950 to-slate-900",
    accent: "text-red-400",
  },
  {
    genre: "Romance",
    title: "Where Peonies Bloom",
    author: "Claire Fontaine",
    gradient: "from-pink-300 via-rose-400 to-fuchsia-500",
    accent: "text-white",
  },
  {
    genre: "Epic Fantasy",
    title: "Crown of Embers",
    author: "R.K. Ashwood",
    gradient: "from-amber-700 via-yellow-600 to-orange-800",
    accent: "text-amber-100",
  },
  {
    genre: "Sci-Fi",
    title: "Neon Horizon",
    author: "Dex Omari",
    gradient: "from-cyan-600 via-indigo-800 to-violet-900",
    accent: "text-cyan-300",
  },
  {
    genre: "Self-Help",
    title: "Atomic Focus",
    author: "Dr. Lena Park",
    gradient: "from-emerald-400 via-teal-500 to-green-700",
    accent: "text-emerald-100",
  },
  {
    genre: "Horror",
    title: "Hollow Ground",
    author: "M. Blackwell",
    gradient: "from-gray-950 via-zinc-900 to-neutral-950",
    accent: "text-gray-300",
  },
];

export function CoverCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: 3000, stopOnInteraction: true })]
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
    <div className="relative">
      {/* Carousel viewport */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="-ml-4 flex">
          {covers.map((cover, i) => {
            const isActive = i === selectedIndex;
            return (
              <div
                key={cover.genre}
                className="min-w-0 flex-[0_0_80%] pl-4 sm:flex-[0_0_33.333%]"
              >
                <div
                  className={`transition-all duration-300 ${
                    isActive
                      ? "scale-100 opacity-100"
                      : "scale-90 opacity-60"
                  }`}
                >
                  {/* Kindle mockup frame for active slide */}
                  <div
                    className={`mx-auto max-w-[220px] sm:max-w-[240px] ${
                      isActive
                        ? "rounded-2xl border-[3px] border-zinc-800 bg-zinc-800 p-1 pb-4 shadow-2xl dark:border-zinc-600 dark:bg-zinc-700"
                        : ""
                    }`}
                  >
                    {/* Cover */}
                    <div
                      className={`relative flex aspect-[5/8] flex-col items-center justify-between overflow-hidden bg-gradient-to-br ${cover.gradient} ${
                        isActive ? "rounded-xl" : "rounded-xl shadow-xl"
                      } p-6 text-center`}
                    >
                      <span
                        className={`text-xs font-medium uppercase tracking-widest ${cover.accent} opacity-80`}
                      >
                        {cover.genre}
                      </span>
                      <div>
                        <h3
                          className={`text-lg font-bold leading-tight sm:text-xl ${cover.accent}`}
                        >
                          {cover.title}
                        </h3>
                        <p
                          className={`mt-2 text-xs ${cover.accent} opacity-70`}
                        >
                          {cover.author}
                        </p>
                      </div>
                      <div />
                    </div>
                    {/* Kindle chin home button */}
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
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border bg-background/80 p-2 shadow-md backdrop-blur transition-colors hover:bg-accent"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={scrollNext}
        aria-label="Next cover"
        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full border bg-background/80 p-2 shadow-md backdrop-blur transition-colors hover:bg-accent"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Dot indicators */}
      <div className="mt-6 flex justify-center gap-2">
        {covers.map((cover, i) => (
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
    </div>
  );
}
