/**
 * Slugs.tsx
 * Resource component for slug selection
 * Uses GenericPicker to select existing slug resources
 * Manages slug_ids array and reports to parent
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

export interface SlugResourceItem {
  id?: string | null;
  value?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface SlugItem {
  id: string;
  value: string;
}

export interface SlugsProps {
  slug_ids?: string[]; // Current slug resource IDs (standardized prop name)
  slug_resources?: SlugResourceItem[]; // Selected slug resources (each includes generated field)
  show_slugs?: boolean; // Whether to show this resource picker
  slugs?: SlugResourceItem[]; // All available slugs from API (each includes generated, suggested, and pending fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update slug_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  aiSlugResources?: Array<{ id?: string | null; value?: string | null }> | null;
  // Legacy props kept for backward compatibility (unused after pending migration)
  isAutosaveEnabled?: boolean;
}

export function Slugs({
  slug_ids,
  slug_resources: _slug_resources,
  show_slugs = false,
  slugs,
  disabled = false,
  onChange,
  label = "Slugs",
  id = "slugs",
  required = false,
  placeholder = "Select slugs...",
  description,
  aiSlugResources: _aiSlugResources,
}: SlugsProps) {
  const ids = useMemo(() => slug_ids ?? [], [slug_ids]);
  const show = show_slugs ?? false;
  const allSlugs = useMemo(() => slugs ?? [], [slugs]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allSlugs.filter((s) => s.pending && s.id);
  }, [allSlugs]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((s) => s.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert slugs array to SlugItem format for GenericPicker
  const slugItems = useMemo(() => {
    return allSlugs
      .filter((s) => s.id && s.value) // Filter out nulls
      .map((s) => ({
        id: s.id!,
        value: s.value!,
      }));
  }, [allSlugs]);

  // Check if a slug is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (slugId: string) => {
      const slug = allSlugs.find((s) => s.id === slugId);
      return slug?.suggested === true;
    },
    [allSlugs]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending slugs in selection (no-op, they're already in ids)
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending slugs from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_slugs is false (AFTER all hooks)
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
      <GenericPicker<SlugItem>
        items={slugItems}
        itemIds={allSlugs
          .map((s) => s.id)
          .filter((id): id is string => id !== null)} // All slug IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.value}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isPending && "ring-2 ring-success bg-success/10 rounded-md px-1",
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Pending badge - priority over selected and suggested */}
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    Pending
                  </span>
                )}
                {/* Suggested dot indicator */}
                {isSuggested(item.id) && !isSelected && !isPending && (
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
                  <div className="truncate">{item.value}</div>
                </div>
              </div>
              {!isPending && (
                <Check
                  className={cn(
                    "ml-auto flex-shrink-0 h-4 w-4",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
            </div>
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
