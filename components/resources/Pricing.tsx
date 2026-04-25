/**
 * Pricing.tsx
 * Resource component for pricing selection
 * Uses GenericPicker to select existing pricing resources
 * Pure UI: data in, IDs out via onChange
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface PricingResourceItem {
  id?: string | null;
  pricing_id?: string | null;
  pricing_type?: string | null;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  unit_name?: string | null;
  unit_category?: string | null;
  unit_value?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface PricingItem {
  id: string;
  name: string;
  description?: string;
}

export interface PricingDraft {
  pricing_type: string;
  price: number;
  unit_name: string;
  unit_category: string;
  unit_value: number;
}

// Common rate presets — atomically fill the unit_* fields together so we
// avoid malformed combinations (e.g. unit_name="1M" + unit_value=1000).
const PRICING_PRESETS: Array<{
  key: string;
  label: string;
  unit_name: string;
  unit_category: string;
  unit_value: number;
}> = [
  { key: "1m_tokens", label: "per 1M tokens", unit_name: "1M tokens", unit_category: "tokens", unit_value: 1_000_000 },
  { key: "1k_tokens", label: "per 1K tokens", unit_name: "1K tokens", unit_category: "tokens", unit_value: 1_000 },
  { key: "request", label: "per request", unit_name: "request", unit_category: "requests", unit_value: 1 },
  { key: "minute", label: "per minute", unit_name: "minute", unit_category: "minutes", unit_value: 1 },
  { key: "second", label: "per second", unit_name: "second", unit_category: "seconds", unit_value: 1 },
];

export interface PricingProps {
  pricing_ids?: string[];
  show_pricing?: boolean;
  pricings?: PricingResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  /** Optional inline-create handler. When provided, renders a "+ New" affordance. */
  onCreate?: (draft: PricingDraft) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Pricing({
  pricing_ids,
  show_pricing = false,
  pricings,
  disabled = false,
  onChange,
  onCreate,
  label = "Pricing",
  id = "pricing",
  required = false,
  placeholder: _placeholder = "Select pricing...",
  description,
  searchTerm,
  onSearchChange: _onSearchChange,
}: PricingProps) {
  // Inline-create form state. Collapsed by default; opens via "+ New".
  const [createOpen, setCreateOpen] = useState(false);
  const [draftType, setDraftType] = useState<string>("");
  const [draftTypeIsCustom, setDraftTypeIsCustom] = useState(false);
  const [draftPrice, setDraftPrice] = useState<string>("");
  const [draftPresetKey, setDraftPresetKey] = useState<string>("1m_tokens");
  const [draftUnitName, setDraftUnitName] = useState<string>("");
  const [draftUnitCategory, setDraftUnitCategory] = useState<string>("");
  const [draftUnitValue, setDraftUnitValue] = useState<string>("1");

  const resetDraft = useCallback(() => {
    setDraftType("");
    setDraftTypeIsCustom(false);
    setDraftPrice("");
    setDraftPresetKey("1m_tokens");
    setDraftUnitName("");
    setDraftUnitCategory("");
    setDraftUnitValue("1");
  }, []);
  const ids = useMemo(() => pricing_ids ?? [], [pricing_ids]);
  const show = show_pricing ?? false;
  const allPricing = useMemo(() => pricings ?? [], [pricings]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allPricing.filter((p) => p.pending && p.pricing_id);
  }, [allPricing]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.pricing_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  const filteredPricing = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allPricing;
    }
    const term = searchTerm.toLowerCase();
    return allPricing.filter((pricing) => {
      const name = pricing.name?.toLowerCase() ?? "";
      const desc = pricing.description?.toLowerCase() ?? "";
      return name.includes(term) || desc.includes(term);
    });
  }, [allPricing, searchTerm]);

  // Convert pricing array to PricingItem format for SelectableGrid
  const pricingItems = useMemo<(PricingItem & { price?: number | null; unit_name?: string | null })[]>(() => {
    return filteredPricing
      .filter((m) => m.pricing_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.pricing_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
        price: m.price ?? null,
        unit_name: m.unit_name ?? null,
      }));
  }, [filteredPricing]);

  // Check if a pricing is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (pricingId: string) => {
      const pricing = allPricing.find((p) => p.pricing_id === pricingId);
      return pricing?.suggested === true;
    },
    [allPricing]
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      onChange(
        ids.includes(itemId) ? ids.filter((x) => x !== itemId) : [...ids, itemId],
      );
    },
    [ids, onChange]
  );

  // Accept pending — keep pending pricing in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending pricing from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Catalog-derived list of distinct pricing_type values, ordered by appearance.
  const catalogTypes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of allPricing) {
      const t = item.pricing_type?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
    return out;
  }, [allPricing]);

  const selectedPreset = useMemo(
    () => PRICING_PRESETS.find((p) => p.key === draftPresetKey) ?? null,
    [draftPresetKey],
  );

  const handleCreateSubmit = useCallback(() => {
    if (!onCreate) return;
    const type = draftType.trim();
    const price = Number.parseFloat(draftPrice);
    if (!type || !Number.isFinite(price)) return;

    let unit_name: string;
    let unit_category: string;
    let unit_value: number;
    if (draftPresetKey === "custom") {
      unit_name = draftUnitName.trim();
      unit_category = draftUnitCategory.trim();
      const parsed = Number.parseInt(draftUnitValue, 10);
      unit_value = Number.isFinite(parsed) ? parsed : 1;
      if (!unit_name || !unit_category) return;
    } else if (selectedPreset) {
      unit_name = selectedPreset.unit_name;
      unit_category = selectedPreset.unit_category;
      unit_value = selectedPreset.unit_value;
    } else {
      return;
    }

    onCreate({
      pricing_type: type,
      price,
      unit_name,
      unit_category,
      unit_value,
    });
    resetDraft();
    setCreateOpen(false);
  }, [
    onCreate,
    draftType,
    draftPrice,
    draftPresetKey,
    selectedPreset,
    draftUnitName,
    draftUnitCategory,
    draftUnitValue,
    resetDraft,
  ]);

  // Don't render if show_pricing is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {(label || onCreate) && (
        <div className="flex items-center gap-2">
          {label && (
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {required && <span className="text-destructive">*</span>}
              {description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {description}
                </span>
              )}
            </Label>
          )}
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          {onCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setCreateOpen((v) => !v)}
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {createOpen ? "Cancel" : "New pricing"}
            </Button>
          )}
        </div>
      )}

      {onCreate && createOpen && (
        <div className="rounded-md border bg-card p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor={`${id}-new-type`} className="text-xs">
                Pricing type
              </Label>
              {draftTypeIsCustom ? (
                <div className="flex items-center gap-1">
                  <Input
                    id={`${id}-new-type`}
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value)}
                    placeholder="e.g. input_tokens"
                    disabled={disabled}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setDraftTypeIsCustom(false);
                      setDraftType("");
                    }}
                    disabled={disabled}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Select
                  {...(draftType ? { value: draftType } : {})}
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setDraftTypeIsCustom(true);
                      setDraftType("");
                    } else {
                      setDraftType(v);
                    }
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger id={`${id}-new-type`} className="h-8">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                    {catalogTypes.length > 0 && (
                      <div className="my-1 border-t" />
                    )}
                    <SelectItem value="__custom__">+ Custom type…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor={`${id}-new-price`} className="text-xs">
                Price ($)
              </Label>
              <Input
                id={`${id}-new-price`}
                type="number"
                step="0.0001"
                min={0}
                value={draftPrice}
                onChange={(e) => setDraftPrice(e.target.value)}
                placeholder="0.00"
                disabled={disabled}
                className="h-8"
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor={`${id}-new-per`} className="text-xs">
                Per
              </Label>
              <Select
                value={draftPresetKey}
                onValueChange={setDraftPresetKey}
                disabled={disabled}
              >
                <SelectTrigger id={`${id}-new-per`} className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_PRESETS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <div className="my-1 border-t" />
                  <SelectItem value="custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {draftPresetKey === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor={`${id}-new-unit-value`} className="text-xs">
                  Unit value
                </Label>
                <Input
                  id={`${id}-new-unit-value`}
                  type="number"
                  min={1}
                  value={draftUnitValue}
                  onChange={(e) => setDraftUnitValue(e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-new-unit-name`} className="text-xs">
                  Unit name
                </Label>
                <Input
                  id={`${id}-new-unit-name`}
                  value={draftUnitName}
                  onChange={(e) => setDraftUnitName(e.target.value)}
                  placeholder="e.g. 1M tokens"
                  disabled={disabled}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-new-unit-category`} className="text-xs">
                  Unit category
                </Label>
                <Input
                  id={`${id}-new-unit-category`}
                  value={draftUnitCategory}
                  onChange={(e) => setDraftUnitCategory(e.target.value)}
                  placeholder="e.g. tokens"
                  disabled={disabled}
                  className="h-8"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetDraft();
                setCreateOpen(false);
              }}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={
                disabled ||
                !draftType.trim() ||
                !draftPrice.trim() ||
                Number.isNaN(Number.parseFloat(draftPrice)) ||
                (draftPresetKey === "custom" &&
                  (!draftUnitName.trim() || !draftUnitCategory.trim()))
              }
            >
              Add pricing
            </Button>
          </div>
        </div>
      )}

      <SelectableGrid<(typeof pricingItems)[0]>
        horizontal
        items={pricingItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex flex-col justify-center flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{item.name}</span>
                {item.price != null && item.unit_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    ${item.price} / {item.unit_name}
                  </span>
                )}
                {item.description && (item.price == null || !item.unit_name) && (
                  <span className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No pricing available."
        disabled={disabled}
      />
    </div>
  );
}
