import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Download,
  Type,
  Paintbrush,
  Wand,
  History,
  Check,
  ArrowRight,
  Coins,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { CoverShowcase } from "@/components/landing/cover-showcase";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { FadeIn } from "@/components/landing/fade-in";

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
    icon: Wand,
    title: "AI-Powered Quick Create",
    description:
      "Describe your book and get covers in one click. Our AI analyzes your description and automatically selects genre, mood, art style, and visual attributes.",
  },
  {
    icon: History,
    title: "Generation History",
    description:
      "Every generation is saved with its attributes. Compare results side-by-side, see what changed, and revert to any previous version.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "25 credits / month",
      "~5-8 covers depending on quality preset",
      "Full-res KDP export",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    features: [
      "100 credits / month",
      "~20-33 covers depending on quality preset",
      "Full-res KDP export",
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
      "250 credits / month",
      "~50-83 covers depending on quality preset",
      "Priority queue",
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
        <div className="absolute inset-0 -z-10 dot-grid mask-radial-fade" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_-20%,oklch(0.556_0_0/0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_50%_-20%,oklch(0.985_0_0/0.04)_0%,transparent_70%)]" />

        <div className="container mx-auto max-w-4xl px-4 py-32 text-center lg:py-40">
          <FadeIn delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary animate-shimmer" />
              AI-powered cover generation
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-7xl">
              Your Book Deserves a Cover
              <br />
              <span className="relative inline-block">
                That Sells
                <span
                  className="absolute -bottom-1 left-0 h-3 w-full rounded-sm bg-primary/15"
                  aria-hidden="true"
                />
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Describe your story, choose a style, and get KDP-ready cover options
              in minutes. Fine-tune with typography, AI region editing, and
              one-click export.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/create"
                className={buttonVariants({
                  size: "lg",
                  className: "h-11 gap-2 px-8 text-base shadow-lg shadow-primary/10",
                })}
              >
                Start Free <ArrowRight className="size-4" />
              </Link>
              <Link
                href="#features"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className: "h-11 px-8 text-base",
                })}
              >
                See Features
              </Link>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Check className="size-3.5 text-primary" />
              Start with 25 free credits. No credit card required.
            </p>
          </FadeIn>

          <CoverShowcase />
        </div>
      </section>

      {/* Product showcase */}
      <ProductShowcase />

      {/* Features */}
      <section id="features" className="relative bg-muted/20 py-28">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-16 text-center">
            <p className="mb-3 text-sm font-medium tracking-widest text-muted-foreground/70 uppercase">
              Features
            </p>
            <h2 className="text-3xl font-bold">
              Built for Self-Publishers
            </h2>
            <p className="mt-3 text-muted-foreground">
              From generation to KDP upload — no design skills required.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.15} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-xl bg-card p-6 ring-1 ring-foreground/[0.05] transition-all duration-200 hover:shadow-lg hover:ring-foreground/15">
                  <div className="absolute inset-x-0 top-0 h-px bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-4 inline-flex rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-2.5">
                    <f.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="text-[0.8125rem] leading-6 text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-28">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <p className="mb-3 text-sm font-medium tracking-widest text-muted-foreground/70 uppercase">
            Pricing
          </p>
          <h2 className="mb-4 text-3xl font-bold">Simple Pricing</h2>
          <p className="mb-14 text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
          <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-3">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.1}>
                <Card
                  className={`flex flex-col ${
                    plan.highlighted
                      ? "relative z-10 scale-[1.02] overflow-visible border-transparent bg-primary text-primary-foreground ring-0 shadow-xl"
                      : ""
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background px-4 py-1 text-xs font-semibold text-foreground ring-1 ring-foreground/10">
                      Most Popular
                    </div>
                  )}
                  <CardContent className="flex flex-1 flex-col p-8 text-center">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="mt-3">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span
                        className={`text-sm ${
                          plan.highlighted
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {plan.period}
                      </span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-3 text-left text-sm">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <Check
                            className={`size-4 shrink-0 ${
                              plan.highlighted
                                ? "text-primary-foreground/70"
                                : "text-primary"
                            }`}
                          />
                          {f.includes("credits / month") ? (
                            <span className="flex items-center gap-1">
                              <Coins className="size-3 text-yellow-500" />
                              {f}
                            </span>
                          ) : (
                            f
                          )}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/create"
                      className={buttonVariants({
                        className: "mt-8 w-full",
                        variant: plan.highlighted ? "secondary" : "outline",
                      })}
                    >
                      {plan.cta}
                    </Link>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="size-4 text-primary" />
              BookClad
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              AI-powered book covers for Amazon KDP. From prompt to
              publish-ready in minutes.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="/create"
                className="transition-colors hover:text-foreground"
              >
                Get Started
              </Link>
              <Link
                href="#features"
                className="transition-colors hover:text-foreground"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
            </div>
            <div className="h-px w-12 bg-border" />
            <p className="text-xs text-muted-foreground/70">
              &copy; 2026 BookClad. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
