/**
 * Values.tsx
 * Resource component for values selection
 * Uses GenericPicker to select existing values resources
 * Manages value_ids array and reports to parent
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

type FlushResult = { value_ids: string[] } | void;

type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;

// Derive resource item type from the GET endpoint response
type ValueGetResponse = OutputOf<"/api/v4/resources/values/get", "post">;
export type ValueResourceItem = NonNullable<ValueGetResponse["items"]>[number];

export interface ValuesItem {
  id: string;
  name: string;
  description?: string;
}

export interface ValuesProps {
  value_ids?: string[]; // Current values resource IDs (standardized prop name)
  value_resources?: ValueResourceItem[]; // Selected values resources
  show_values?: boolean; // Whether to show this resource picker
  value_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  values?: ValueResourceItem[]; // All available values from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update value_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createValuesAction?:
    | ((input: CreateDraftValuesIn) => Promise<CreateDraftValuesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isGenerating?: boolean;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  // AI diff view props
  aiValueResources?: Pick<ValueResourceItem, "id" | "value">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Values({
  value_ids,
  value_resources,
  show_values = false,
  value_suggestions,
  values,
  disabled = false,
  onChange,
  label = "Values",
  id = "values",
  required = false,
  placeholder = "Select values...",
  description,
  searchTerm,
  onSearchChange,
  group_id,
  create_tool_id,
  createValuesAction,
  onGenerate,
  showAiGenerate = false,
  isGenerating = false,
  isAutosaveEnabled: _isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiValueResources,
  onAccept,
  onReject,
}: ValuesProps) {
  const ids = useMemo(() => value_ids ?? [], [value_ids]);
  const show = show_values ?? false;
  const allValues = useMemo(() => values ?? [], [values]);
  const suggestionsList = useMemo(
    () => value_suggestions ?? [],
    [value_suggestions]
  );
  const filteredValues = useMemo(() => {
    if (!searchTerm?.trim()) {
      return allValues;
    }
    const term = searchTerm.toLowerCase();
    return allValues.filter((value) => {
      const val = value.value?.toLowerCase() ?? "";
      return val.includes(term);
    });
  }, [allValues, searchTerm]);

  // Track which values IDs have already had resources created
  const createdValuesIdsRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    // For Values, the flush returns the current selection
    // Resources are selected from existing values, so just return current IDs
    if (!group_id) {
      return;
    }
    return { value_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Initialize createdValuesIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdValuesIdsRef.current.add(id));
  }, [ids]);

  // Convert values array to ValuesItem format for GenericPicker
  const valuesItems = useMemo(() => {
    return filteredValues
      .filter((m) => m.id && m.value) // Filter out nulls
      .map((m) => ({
        id: m.id!,
        name: m.value!,
      }));
  }, [filteredValues]);

  // Check if a values is suggested
  const isSuggested = useCallback(
    (valuesId: string) => suggestionsList.includes(valuesId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Values are generated, not selected from existing artifacts
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any values resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return value_resources?.some((m) => m.generated) ?? false;
  }, [value_resources]);

  // AI suggestion state
  const showDiff = !!aiValueResources?.length;

  // Accept AI suggestion - add AI-suggested values to selection
  const handleAccept = useCallback(() => {
    if (!aiValueResources?.length) return;
    const aiIds = aiValueResources
      .map((r) => r.id)
      .filter((id): id is string => !!id);
    // Add AI-suggested IDs to existing selection
    const newIds = [...ids, ...aiIds.filter((id) => !ids.includes(id))];
    onChange(newIds);
    onAccept?.();
  }, [aiValueResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_values is false (AFTER all hooks)
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
          {onGenerate && showAiGenerate && create_tool_id && (
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
      {/* AI-suggested values preview */}
      {showDiff && aiValueResources && aiValueResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Values</p>
          <div className="space-y-2">
            {aiValueResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.value || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <GenericPicker<ValuesItem>
        items={valuesItems}
        itemIds={filteredValues
          .map((m) => m.id)
          .filter((id): id is string => id !== null)} // All values IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
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
