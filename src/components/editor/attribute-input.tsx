"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { AddValuePopover } from "@/components/add-value-popover";
import { slugify, getDefaultValue, getActiveValues, type Attribute } from "@/lib/attributes";

function AttributeLabel({ attribute, onRemove, isDraft, onDiscardDraft }: { attribute: Attribute; onRemove?: () => void; isDraft?: boolean; onDiscardDraft?: () => void }) {
  const nameNode = attribute.description ? (
    <HoverCard>
      <HoverCardTrigger
        render={<span />}
        className="underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help"
      >
        {attribute.name}
      </HoverCardTrigger>
      <HoverCardContent side="right" className="text-sm">
        {attribute.description}
      </HoverCardContent>
    </HoverCard>
  ) : (
    <>{attribute.name}</>
  );

  return (
    <Label>
      <span className="flex items-center gap-1">
        {nameNode}
        {isDraft && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<button type="button" />}
                className="flex items-center cursor-pointer"
                onClick={onDiscardDraft}
              >
                <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top">Click to revert to generated value</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onRemove && (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/attr:opacity-100"
            onClick={onRemove}
          >
            <XIcon className="size-3" />
          </button>
        )}
      </span>
    </Label>
  );
}

interface AttributeInputProps {
  attribute: Attribute;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onAddCustomValue?: (value: string, label: string, description?: string) => void;
  onRemoveCustomValue?: (value: string) => void;
  onRemove?: () => void;
  isDraft?: boolean;
  onDiscardDraft?: () => void;
}

export function AttributeInput({
  attribute,
  value,
  onChange,
  onAddCustomValue,
  onRemoveCustomValue,
  onRemove,
  isDraft,
  onDiscardDraft,
}: AttributeInputProps) {
  if (attribute.type === "toggle") {
    return (
      <div className="group/attr flex items-center justify-between">
        <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
        <Switch
          checked={value === "true"}
          onCheckedChange={(c) => onChange(c ? "true" : "false")}
        />
      </div>
    );
  }

  if (attribute.type === "scale") {
    const num = parseInt(value as string, 10) || 5;
    return (
      <div className="group/attr space-y-1.5">
        <div className="flex items-center justify-between">
          <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {num}/10
          </span>
        </div>
        <Slider
          min={0}
          max={10}
          step={1}
          value={[num]}
          onValueChange={(vals) => onChange(String(Array.isArray(vals) ? vals[0] : vals))}
        />
        {attribute.scaleLabels && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{attribute.scaleLabels.min}</span>
            <span>{attribute.scaleLabels.max}</span>
          </div>
        )}
      </div>
    );
  }

  if (attribute.type === "color") {
    return (
      <div className="group/attr space-y-1.5">
        <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) || (getDefaultValue("color") as string)}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <Input
            value={(value as string) || (getDefaultValue("color") as string)}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="#000000"
          />
        </div>
      </div>
    );
  }

  if (attribute.type === "text") {
    return (
      <div className="group/attr space-y-1.5">
        <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
        <Textarea
          rows={3}
          placeholder={`Enter ${attribute.name.toLowerCase()}...`}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (attribute.type === "single") {
    return (
      <SingleSelect
        attribute={attribute}
        value={value as string}
        onChange={(v) => onChange(v)}
        onAddCustomValue={onAddCustomValue}
        onRemove={onRemove}
        isDraft={isDraft}
        onDiscardDraft={onDiscardDraft}
      />
    );
  }

  return (
    <MultiSelect
      attribute={attribute}
      value={value as string[]}
      onChange={(v) => onChange(v)}
      onAddCustomValue={onAddCustomValue}
      onRemoveCustomValue={onRemoveCustomValue}
      onRemove={onRemove}
      isDraft={isDraft}
      onDiscardDraft={onDiscardDraft}
    />
  );
}

function SingleSelect({
  attribute,
  value,
  onChange,
  onAddCustomValue,
  onRemove,
  isDraft,
  onDiscardDraft,
}: {
  attribute: Attribute;
  value: string;
  onChange: (value: string) => void;
  onAddCustomValue?: (value: string, label: string, description?: string) => void;
  onRemove?: () => void;
  isDraft?: boolean;
  onDiscardDraft?: () => void;
}) {
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const options = getActiveValues(attribute).map((v) => ({
    value: v.value,
    label: v.label,
    description: v.description,
  }));

  function handleAdd(label: string, description?: string): void {
    const slug = slugify(label);
    onAddCustomValue?.(slug, label, description);
    onChange(slug);
  }

  return (
    <div className="group/attr space-y-1.5">
      <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
      <AddValuePopover
        open={pendingLabel !== null}
        onOpenChange={(open) => { if (!open) setPendingLabel(null); }}
        initialLabel={pendingLabel ?? ""}
        onAdd={handleAdd}
      >
        <div>
          <Combobox
            options={options}
            value={value}
            onChange={onChange}
            placeholder={`Select ${attribute.name.toLowerCase()}...`}
            onCreateOption={
              onAddCustomValue
                ? (label) => setPendingLabel(label)
                : undefined
            }
          />
        </div>
      </AddValuePopover>
    </div>
  );
}

function MultiSelect({
  attribute,
  value,
  onChange,
  onAddCustomValue,
  onRemoveCustomValue,
  onRemove,
  isDraft,
  onDiscardDraft,
}: {
  attribute: Attribute;
  value: string[];
  onChange: (value: string[]) => void;
  onAddCustomValue?: (value: string, label: string, description?: string) => void;
  onRemoveCustomValue?: (value: string) => void;
  onRemove?: () => void;
  isDraft?: boolean;
  onDiscardDraft?: () => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  function toggle(val: string): void {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  }

  function handleAdd(label: string, description?: string): void {
    const slug = slugify(label);
    if (attribute.values.some((v) => v.value === slug)) {
      if (!value.includes(slug)) {
        onChange([...value, slug]);
      }
    } else {
      onAddCustomValue?.(slug, label, description);
      onChange([...value, slug]);
    }
  }

  return (
    <div className="group/attr space-y-1.5">
      <AttributeLabel attribute={attribute} onRemove={onRemove} isDraft={isDraft} onDiscardDraft={onDiscardDraft} />
      <div className="flex flex-wrap gap-1.5">
        {getActiveValues(attribute).map((v) => {
          const badge = (
            <Badge
              data-value={v.value}
              variant={value.includes(v.value) ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => toggle(v.value)}
            >
              {v.label}
              {!v.builtIn && onRemoveCustomValue && (
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-foreground/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((val) => val !== v.value));
                    onRemoveCustomValue(v.value);
                  }}
                >
                  <XIcon className="size-2.5" />
                </button>
              )}
            </Badge>
          );

          return v.description ? (
            <HoverCard key={v.value}>
              <HoverCardTrigger render={<span />}>{badge}</HoverCardTrigger>
              <HoverCardContent className="text-sm">{v.description}</HoverCardContent>
            </HoverCard>
          ) : (
            <span key={v.value}>{badge}</span>
          );
        })}
        <AddValuePopover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          onAdd={handleAdd}
        >
          <Badge
            variant="outline"
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setPopoverOpen(true)}
          >
            <PlusIcon className="mr-0.5 size-3" />
            Add
          </Badge>
        </AddValuePopover>
      </div>
    </div>
  );
}
