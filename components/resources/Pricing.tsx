/**
 * Pricing.tsx
 * Resource component for pricing selection
 * Uses GenericPicker to select existing pricing resources
 * Pure UI: data in, IDs out via onChange
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface PricingResourceItem {
  id?: string | null;
  pricing_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface PricingItem {
  id: string;
  name: string;
  description?: string;
}

export interface PricingProps {
  pricing_ids?: string[]; // Current pricing resource IDs (standardized prop name)
  pricing_resources?: PricingResourceItem[]; // Selected pricing resources (each includes generated field)
  show_pricing?: boolean; // Whether to show this resource picker
  pricings?: PricingResourceItem[]; // All available pricing from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update pricing_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  aiPricingResources?: Array<{
    pricing_id?: string | null;
    name?: string | null;
  }> | null;
}

export function Pricing({
  pricing_ids,
  pricing_resources: _pricing_resources,
  show_pricing = false,
  pricings,
  disabled = false,
  onChange,
  label = "Pricing",
  id = "pricing",
  required = false,
  placeholder = "Select pricing...",
  description,
  searchTerm,
  onSearchChange,
  aiPricingResources: _aiPricingResources,
}: PricingProps) {
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

  // Convert pricing array to PricingItem format for GenericPicker
  const pricingItems = useMemo(() => {
    return filteredPricing
      .filter((m) => m.pricing_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.pricing_id!,
        name: m.name!,
        ...(m.description ? { description: m.description } : {}),
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
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
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

  // Don't render if show_pricing is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
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
        </div>
      )}
      <GenericPicker<PricingItem>
        items={pricingItems}
        itemIds={filteredPricing
          .map((m) => m.pricing_id)
          .filter((id): id is string => id !== null)} // All pricing IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    Pending
                  </span>
                )}
                {!isPending && isSuggested(item.id) && !isSelected && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
              <Check
                className={cn(
                  "ml-auto flex-shrink-0 h-4 w-4",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          );
        }}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
