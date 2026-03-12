import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Download,
  Type,
  Paintbrush,
  ShieldCheck,
  Box,
  Check,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Sparkles,
    title: "Genre-Aware AI",
    description:
      "Our AI understands the visual language of thriller, romance, fantasy, and 10+ genres — your cover signals the right shelf instantly.",
  },
  {
    icon: Download,
    title: "KDP-Ready Export",
    description:
      "Every cover exports at 1600 x 2560 px, RGB, 300 DPI JPEG — guaranteed compliant with Amazon KDP specifications.",
  },
  {
    icon: Type,
    title: "Built-in Typography",
    description:
      "Add title, subtitle, and author name with genre-matched fonts, safe-zone guides, and legibility effects.",
  },
  {
    icon: Paintbrush,
    title: "AI Region Editing",
    description:
      "Don't like the sky? Paint over it and describe the change. Refine without regenerating the entire cover.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Checker",
    description:
      "Automated pre-export checks catch dimension, contrast, and safe-zone issues before you upload to KDP.",
  },
  {
    icon: Box,
    title: "3D Book Mockups",
    description:
      "Export a 3D rendering of your cover for social media, your website, and marketing materials.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["3 covers / month", "Low-res preview", "Watermarked exports"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    features: [
      "20 covers / month",
      "Full-res JPEG export",
      "3D mockups",
      "Priority queue",
    ],
    cta: "Get Started",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: [
      "Unlimited covers",
      "Series mode",
      "Batch export",
      "Social media pack",
      "Priority support",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="container mx-auto max-w-4xl px-4 py-28 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            AI-powered cover generation
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Professional Book Covers
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              in Minutes, Not Days
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Describe your book. Pick a genre and style. Get 4 AI-generated,
            KDP-compliant cover options — then fine-tune with typography, region
            editing, and a built-in compliance checker.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-6",
              })}
            >
              Start Free <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#features"
              className={buttonVariants({
                size: "lg",
                variant: "outline",
                className: "px-6",
              })}
            >
              See Features
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            3 free generations per month. No credit card required.
          </p>
        </div>
      </section>

      {/* Cover preview placeholder */}
      <section className="container mx-auto max-w-5xl px-4 pb-20">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 perspective-1000">
          {[
            "from-indigo-500/20 to-purple-600/20",
            "from-amber-500/20 to-rose-600/20",
            "from-emerald-500/20 to-teal-600/20",
          ].map((gradient, i) => (
            <div
              key={i}
              className={`aspect-[5/8] w-36 rounded-xl bg-gradient-to-br ${gradient} border shadow-xl transition-transform hover:scale-105 sm:w-48`}
            />
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold">
              Everything You Need for a Professional Cover
            </h2>
            <p className="mt-3 text-muted-foreground">
              From generation to KDP upload — no design skills required.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="group transition-shadow hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5">
                    <f.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Simple Pricing</h2>
          <p className="mb-14 text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "relative border-primary shadow-lg ring-1 ring-primary/20"
                    : ""
                }
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <CardContent className="p-6 text-center">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <ul className="mt-6 space-y-3 text-left text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/sign-up"
                    className={buttonVariants({
                      className: "mt-8 w-full",
                      variant: plan.highlighted ? "default" : "outline",
                    })}
                  >
                    {plan.cta}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4 text-primary" />
            CoverCraft
          </div>
          <p className="text-sm text-muted-foreground">
            AI-powered book covers for Amazon KDP
          </p>
        </div>
      </footer>
    </main>
  );
}
