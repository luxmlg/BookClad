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
