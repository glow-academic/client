/**
 * Qualities.tsx
 * Resource component for qualities selection
 * Uses GenericPicker to select existing qualities resources
 * Manages quality_ids array and reports to parent
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

export interface QualitiesResourceItem {
  id?: string | null;
  quality?: string | null;
  quality_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface QualitiesItem {
  id: string;
  name: string;
  description?: string;
}

export interface QualitiesProps {
  quality_ids?: string[]; // Current qualities resource IDs (standardized prop name)
  quality_resources?: QualitiesResourceItem[]; // Selected qualities resources (each includes generated field)
  show_qualities?: boolean; // Whether to show this resource picker
  qualities?: QualitiesResourceItem[]; // All available qualities from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update quality_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function Qualities({
  quality_ids,
  quality_resources: _quality_resources,
  show_qualities = false,
  qualities,
  disabled = false,
  onChange,
  label = "Qualities",
  id = "qualities",
  required = false,
  placeholder = "Select qualities...",
  description,
  searchTerm,
  onSearchChange,
}: QualitiesProps) {
  const ids = useMemo(() => quality_ids ?? [], [quality_ids]);
  const show = show_qualities ?? false;
  const allQualities = useMemo(() => qualities ?? [], [qualities]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allQualities.filter((q) => q.pending && q.id);
  }, [allQualities]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((q) => q.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  const filteredQualities = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allQualities;
    }
    const term = searchTerm.toLowerCase();
    return allQualities.filter((quality) => {
      const qualityName = quality.quality?.toLowerCase() ?? "";
      return qualityName.includes(term);
    });
  }, [allQualities, searchTerm]);

  // Convert qualities array to QualitiesItem format for GenericPicker
  const qualitiesItems = useMemo(() => {
    return filteredQualities
      .filter((m) => m.id && m.quality) // Filter out nulls
      .map((m) => ({
        id: m.id!,
        name: m.quality!,
      }));
  }, [filteredQualities]);

  // Check if a quality is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (qualitiesId: string) => {
      const qual = allQualities.find((q) => q.id === qualitiesId);
      return qual?.suggested === true;
    },
    [allQualities]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending qualities in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending qualities from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

  // Don't render if show_qualities is false (AFTER all hooks)
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
      <GenericPicker<QualitiesItem>
        items={qualitiesItems}
        itemIds={filteredQualities
          .map((m) => m.id)
          .filter((id): id is string => id !== null)} // All qualities IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isPending && "ring-2 ring-success bg-success/10 rounded px-2 py-1 -mx-2 -my-1"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    Pending
                  </span>
                )}
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
                  isSelected && !isPending ? "opacity-100" : "opacity-0"
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
