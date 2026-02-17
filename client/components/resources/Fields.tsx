/**
 * Fields.tsx
 * Resource component for field selection
 * Uses SelectableGrid for field selection with search/filter support
 * Manages field_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type FieldsGetResponse = OutputOf<"/api/v4/resources/fields/get", "post">;
export type FieldResourceItem = NonNullable<FieldsGetResponse["items"]>[number];

export interface FieldItem {
  id: string;
  name: string;
  description?: string;
}

export interface FieldsProps {
  field_ids?: string[]; // Current field resource IDs (standardized prop name)
  field_resources?: FieldResourceItem[]; // Selected field resources (each includes generated field)
  show_fields?: boolean; // Whether to show this resource picker
  field_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  fields?: FieldResourceItem[]; // All available fields from API (each includes generated field)
  parameterIdFilter?: string | null; // Only show fields with this parameter_id
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update field_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  searchTerm?: string; // Search term for filtering fields
  showSelectedFilter?: boolean; // Whether to show only selected fields
  // Legacy props for backward compatibility
  fieldIds?: string[];
  // AI diff view props
  aiFieldResources?: Array<Pick<FieldResourceItem, "field_id" | "name">> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Fields({
  field_ids,
  field_resources: _field_resources,
  show_fields = false,
  field_suggestions: _field_suggestions,
  fields,
  parameterIdFilter,
  disabled = false,
  onChange,
  label = "Fields",
  id = "fields",
  required = false,
  placeholder: _placeholder = "Select fields...",
  description,
  group_id,
  onGenerate,
  showAiGenerate = false,
  searchTerm = "",
  showSelectedFilter = false,
  // Legacy props for backward compatibility
  fieldIds,
}: FieldsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(() => field_ids ?? fieldIds ?? [], [field_ids, fieldIds]);
  const show = show_fields ?? false;
  const allFieldsMemo = useMemo(() => fields ?? [], [fields]);
  const suggestionsList = useMemo(
    () => _field_suggestions ?? [],
    [_field_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "fields",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((f) => f.field_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert fields array to FieldItem format for SelectableGrid
  const fieldItems = useMemo(() => {
    return allFieldsMemo
      .filter((f) => f.field_id && f.name) // Filter out nulls
      .filter((f) => {
        // Apply parameter_id filter if provided
        if (parameterIdFilter) {
          return f.conditional_parameter_ids?.includes(parameterIdFilter) ?? false;
        }
        return true;
      })
      .map((f) => ({
        id: f.field_id!,
        name: f.name!,
        ...(f.description && { description: f.description }),
      }));
  }, [allFieldsMemo, parameterIdFilter]);

  // Filter fields based on search term
  const filteredFields = useMemo(() => {
    let filtered = fieldItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((field) => {
        const searchText =
          `${field.name} ${field.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((field) => ids.includes(field.id));
    }

    return filtered;
  }, [fieldItems, searchTerm, showSelectedFilter, ids]);

  // Check if a field is suggested
  const isSuggested = useCallback(
    (fieldId: string) => suggestionsList.includes(fieldId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (fieldId: string) => {
      const isSelected = ids.includes(fieldId);
      const newIds = isSelected
        ? ids.filter((id) => id !== fieldId)
        : [...ids, fieldId];

      // Update parent state
      onChange(newIds);
    },
    [ids, onChange]
  );

  // Check if any field resource is generated
  const hasGenerated = useMemo(() => {
    return _field_resources?.some((f) => f.generated) ?? false;
  }, [_field_resources]);

  // Accept AI suggestion - add AI-suggested fields to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((f) => f.field_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_fields is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2 min-w-0 w-full">
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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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
      <SelectableGrid<FieldItem>
        items={filteredFields}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}

              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-medium text-sm leading-tight truncate pr-16">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No fields found."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
