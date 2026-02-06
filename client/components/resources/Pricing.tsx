/**
 * Pricing.tsx
 * Resource component for pricing selection
 * Uses GenericPicker to select existing pricing resources
 * Manages pricing_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftPricingIn = InputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v4/resources/pricing", "post">;

export interface PricingItem {
  id: string;
  name: string;
  description?: string;
}

export interface PricingProps {
  pricing_ids?: string[]; // Current pricing resource IDs (standardized prop name)
  pricing_resources?: Array<{
    pricing_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected pricing resources (each includes generated field)
  show_pricing?: boolean; // Whether to show this resource picker
  pricing_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  pricings?: Array<{
    pricing_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available pricing from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update pricing_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createPricingAction?:
    | ((input: CreateDraftPricingIn) => Promise<CreateDraftPricingOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiPricingResources?: Array<{ id?: string | null; name?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ pricing_id: string | null } | void>) => void;
}

export function Pricing({
  pricing_ids,
  pricing_resources,
  show_pricing = false,
  pricing_suggestions,
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
  group_id,
  create_tool_id,
  link_tool_id,
  createPricingAction,
  onGenerate,
  isGenerating = false,
  // AI diff view props
  aiPricingResources,
  onAccept,
  onReject,
  isAutosaveEnabled = true,
  registerFlush,
}: PricingProps) {
  const ids = useMemo(() => pricing_ids ?? [], [pricing_ids]);
  const show = show_pricing ?? false;
  const allPricing = useMemo(() => pricings ?? [], [pricings]);
  const suggestionsList = useMemo(
    () => pricing_suggestions ?? [],
    [pricing_suggestions]
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

  // Track which pricing IDs have already had resources created
  const createdPricingIdsRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ pricing_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ pricing_id: string | null } | void> => {
    // Pricing component uses multi-select - flush creates resources for any uncreated selections
    if (!createPricingAction || !group_id) {
      return;
    }

    const uncreatedIds = ids.filter(id => !createdPricingIdsRef.current.has(id));
    for (const pricingId of uncreatedIds) {
      try {
        await createPricingAction({
          body: {
            group_id: group_id,
            pricing_id: pricingId,
            mcp: false,
          },
        });
        createdPricingIdsRef.current.add(pricingId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create pricing resource for ${pricingId}:`, error);
      }
    }

    // Return the first pricing_id or null
    return { pricing_id: ids.length > 0 ? ids[0] : null };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Initialize createdPricingIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdPricingIdsRef.current.add(id));
  }, [ids]);

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

  // Check if a pricing is suggested
  const isSuggested = useCallback(
    (pricingId: string) => suggestionsList.includes(pricingId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Pricing are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any pricing resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return pricing_resources?.some((m) => m.generated) ?? false;
  }, [pricing_resources]);

  // AI suggestion state
  const showDiff = !!aiPricingResources?.length;
  const aiSuggestedIds = useMemo(
    () => new Set(aiPricingResources?.map((r) => r.id).filter(Boolean) as string[]),
    [aiPricingResources]
  );

  // Accept AI suggestion - add AI-suggested pricing to selection
  const handleAccept = useCallback(() => {
    if (!aiPricingResources?.length) return;
    const newIds = aiPricingResources
      .map((r) => r.id)
      .filter((id): id is string => !!id);
    if (newIds.length > 0) {
      const mergedIds = [...new Set([...ids, ...newIds])];
      onChange(mergedIds);
    }
    onAccept?.();
  }, [aiPricingResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
        </div>
      )}
      {/* AI-suggested pricing preview */}
      {showDiff && aiPricingResources && aiPricingResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Pricing</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {aiPricingResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.name || ""}
              </div>
            ))}
          </div>
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
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {aiSuggestedIds.has(item.id) && (
                <span className="px-1.5 py-0.5 bg-success text-success-foreground text-xs rounded shrink-0">
                  AI Suggested
                </span>
              )}
              {!aiSuggestedIds.has(item.id) && isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
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
        )}
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
