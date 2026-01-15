/**
 * Ranges.tsx
 * Unified resource component for range picker fields (min_count - max_count)
 * Supports both single-select (persona, document, parameter ranges) and multi-select (field ranges)
 * Full UI component with Label + Range picker (GenericPicker)
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";

type CreateDraftRangesIn = InputOf<"/api/v4/resources/ranges", "post">;
type CreateDraftRangesOut = OutputOf<"/api/v4/resources/ranges", "post">;

export interface RangeItem {
  id: string;
  min_count: number;
  max_count: number;
  generated?: boolean;
}

// Single-select props
export interface RangesSingleSelectProps {
  range_id?: string | null; // Current range_id (standardized prop name)
  range_resource?: {
    id: string | null;
    min_count: number | null;
    max_count: number | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_range?: boolean; // Whether to show this resource picker
  range_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  ranges?: Array<{
    id: string | null;
    min_count: number | null;
    max_count: number | null;
    generated?: boolean | null;
  }>; // All available ranges from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onRangeIdChange: (rangeId: string | null) => void; // Update range_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createRangesAction?:
    | ((input: CreateDraftRangesIn) => Promise<CreateDraftRangesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

// Multi-select props
export interface RangesMultiSelectProps {
  range_ids?: string[]; // Current range_ids (standardized prop name)
  range_resources?: Array<{
    id: string | null;
    min_count: number | null;
    max_count: number | null;
    generated?: boolean | null;
  }>; // Resource data from server (standardized prop name; includes generated field)
  show_ranges?: boolean; // Whether to show this resource picker
  range_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  ranges?: Array<{
    id: string | null;
    min_count: number | null;
    max_count: number | null;
    generated?: boolean | null;
  }>; // All available ranges from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onRangeIdsChange: (rangeIds: string[]) => void; // Update range_ids in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createRangesAction?:
    | ((input: CreateDraftRangesIn) => Promise<CreateDraftRangesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

// Union type - component accepts either single-select or multi-select props
export type RangesProps = RangesSingleSelectProps | RangesMultiSelectProps;

// Type guard to determine if props are single-select
function isSingleSelect(props: RangesProps): props is RangesSingleSelectProps {
  return "onRangeIdChange" in props;
}

export function Ranges(props: RangesProps) {
  const isSingle = isSingleSelect(props);

  // Single-select props
  const singleSelectProps = isSingle ? props : undefined;
  const range_id = singleSelectProps?.range_id ?? null;
  const range_resource = singleSelectProps?.range_resource ?? null;
  const show_range = singleSelectProps?.show_range ?? false;
  const onRangeIdChange = singleSelectProps?.onRangeIdChange;

  // Multi-select props
  const multiSelectProps = !isSingle ? props : undefined;
  const range_ids = multiSelectProps?.range_ids ?? [];
  const range_resources = multiSelectProps?.range_resources ?? [];
  const show_ranges = multiSelectProps?.show_ranges ?? false;
  const onRangeIdsChange = multiSelectProps?.onRangeIdsChange;

  // Common props
  const {
    range_suggestions = [],
    ranges = [],
    disabled = false,
    label = isSingle ? "Range" : "Ranges",
    id = "range",
    required = false,
    placeholder = isSingle ? "Select a range..." : "Select ranges...",
    group_id,
    agent_id,
    createRangesAction,
    onGenerate,
    isGenerating = false,
  } = props;

  const show = isSingle ? show_range : show_ranges;
  const suggestionsList = useMemo(
    () => range_suggestions ?? [],
    [range_suggestions]
  );

  // Convert ranges array from API format to RangeItem format
  const rangeItems = useMemo(() => {
    return (ranges ?? [])
      .filter((r) => r.id && r.min_count !== null && r.max_count !== null) // Filter out nulls
      .map((r) => ({
        id: r.id!,
        min_count: r.min_count!,
        max_count: r.max_count!,
        generated: r.generated ?? false,
      }));
  }, [ranges]);

  // Check if a range is suggested
  const isSuggested = useCallback(
    (rangeId: string) => suggestionsList.includes(rangeId),
    [suggestionsList]
  );

  // Format range display: "min_count - max_count"
  const formatRange = useCallback((item: RangeItem) => {
    return `${item.min_count} - ${item.max_count}`;
  }, []);

  // Selected IDs for GenericPicker
  const selectedIds = useMemo(() => {
    if (isSingle) {
      return range_id ? [range_id] : [];
    } else {
      return range_ids ?? [];
    }
  }, [isSingle, range_id, range_ids]);

  // Handle selection
  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      if (isSingle) {
        onRangeIdChange?.(selectedIds.length > 0 ? selectedIds[0] : null);
      } else {
        onRangeIdsChange?.(selectedIds);
      }
    },
    [isSingle, onRangeIdChange, onRangeIdsChange]
  );

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
        {onGenerate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGenerate}
            disabled={disabled || isGenerating}
            className="h-7 gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs">Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs">Generate</span>
              </>
            )}
          </Button>
        )}
      </div>

      <GenericPicker<RangeItem>
        items={rangeItems}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        multiSelect={!isSingle}
        getId={(item) => item.id}
        getLabel={formatRange}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{formatRange(item)}</div>
                <div className="text-xs text-muted-foreground">
                  Min: {item.min_count}, Max: {item.max_count}
                </div>
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
        emptyMessage="No ranges available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
        showClearAll={!isSingle}
      />
    </div>
  );
}
