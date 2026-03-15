"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookText, Palette, FileText, Rocket, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AttributeCategoryInput } from "@/components/editor/attribute-category-input";
import type {
  AttributeConfigJson,
  AttributeSelection,
} from "@/lib/attributes";
import {
  buildDefaultConfig,
  buildDefaultSelection,
  getDefaultValue,
  addValueToCategory,
} from "@/lib/attributes";

const STEPS = [
  { label: "Book Info", icon: BookText },
  { label: "Attributes", icon: Palette },
  { label: "Details", icon: FileText },
  { label: "Generate", icon: Rocket },
];

export function BriefWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [attributeConfig, setAttributeConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [attributes, setAttributes] = useState<AttributeSelection>({});
  const [brief, setBrief] = useState("");
  const [imageCount, setImageCount] = useState(4);

  // Fetch user's attribute config
  useEffect(() => {
    fetch("/api/attributes")
      .then((r) => r.json())
      .then((config: AttributeConfigJson) => {
        setAttributeConfig(config);
        setAttributes(buildDefaultSelection(config));
      })
      .catch(() => {
        const def = buildDefaultConfig();
        setAttributes(buildDefaultSelection(def));
      });
  }, []);

  const enabledCategories = attributeConfig.categories.filter(
    (c) => c.enabled
  );

  function addCustomValue(categoryId: string, value: string, label: string) {
    const updated = addValueToCategory(attributeConfig, categoryId, value, label);
    setAttributeConfig(updated);
    fetch("/api/attributes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {});
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          attributes,
          brief: [subtitle, brief].filter(Boolean).join(". "),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await res.json();

      const genRes = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, imageCount }),
      });

      if (!genRes.ok) {
        const data = await genRes.json();
        throw new Error(data.error || "Failed to start generation");
      }

      toast.success("Cover generation started!");
      router.push(`/editor/${project.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setSubmitting(false);
    }
  }

  const canAdvance = () => {
    switch (step) {
      case 0:
        return title.trim() !== "" && author.trim() !== "";
      case 1: {
        // At least one single-select category has a value
        return enabledCategories.some((c) => {
          const val = attributes[c.id];
          if (c.type === "single") return typeof val === "string" && val !== "";
          return Array.isArray(val) && val.length > 0;
        });
      }
      default:
        return true;
    }
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <div>
      <Progress value={progressValue} className="mb-8 h-1.5" />

      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDone
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <Check className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden h-px w-6 sm:block ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Book Information</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the basic details about your book.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">
                  Book Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Enter your book title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">
                  Author Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="author"
                  placeholder="Enter the author name"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle (optional)</Label>
                <Input
                  id="subtitle"
                  placeholder="Enter a subtitle if applicable"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">Style Attributes</h2>
                <p className="text-sm text-muted-foreground">
                  Customize the look and feel of your cover. You can select from
                  presets or type custom values.
                </p>
              </div>
              {enabledCategories.map((category) => (
                <AttributeCategoryInput
                  key={category.id}
                  category={category}
                  value={
                    attributes[category.id] ??
                    getDefaultValue(category.type, category.values[0]?.value)
                  }
                  onChange={(v) =>
                    setAttributes({ ...attributes, [category.id]: v })
                  }
                  onAddCustomValue={(value, label) =>
                    addCustomValue(category.id, value, label)
                  }
                />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Additional Details</h2>
                <p className="text-sm text-muted-foreground">
                  Describe specific visual elements, themes, or imagery
                  you&apos;d like. The more detail, the better.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brief">Description / Keywords</Label>
                <textarea
                  id="brief"
                  rows={5}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="e.g. A lone figure standing on a cliff overlooking a stormy sea, with a glowing sword. Dark clouds, lightning, dramatic lighting..."
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-xl font-semibold">Ready to Generate</h2>
                <p className="text-sm text-muted-foreground">
                  Review your choices and generate cover options.
                </p>
              </div>
              <div className="mx-auto max-w-sm space-y-3 rounded-lg border bg-muted/30 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Title
                  </span>
                  <span className="text-right">{title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">
                    Author
                  </span>
                  <span className="text-right">{author}</span>
                </div>
                {enabledCategories.map((cat) => {
                  const val = attributes[cat.id];
                  if (!val || (Array.isArray(val) && val.length === 0))
                    return null;
                  const display = Array.isArray(val) ? val.join(", ") : val;
                  return (
                    <div key={cat.id} className="flex justify-between">
                      <span className="font-medium text-muted-foreground">
                        {cat.name}
                      </span>
                      <span className="text-right">{display}</span>
                    </div>
                  );
                })}
                {brief && (
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Details
                    </span>
                    <p className="mt-1 text-muted-foreground">{brief}</p>
                  </div>
                )}
              </div>
              <div className="mx-auto max-w-sm space-y-2 text-left">
                <Label htmlFor="imageCount">
                  Number of covers to generate ({imageCount})
                </Label>
                <input
                  id="imageCount"
                  type="range"
                  min={1}
                  max={8}
                  value={imageCount}
                  onChange={(e) => setImageCount(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>8</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Rocket className="size-4" />
                    Generate Covers
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
