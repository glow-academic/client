/**
 * TemplateValues.tsx
 * Resource component for template value selection
 * Uses SelectableGrid for card-based selection with search/filter support
 * Manages template_value_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftTemplateValuesIn = InputOf<
  "/api/v4/resources/template_values",
  "post"
>;
type CreateDraftTemplateValuesOut = OutputOf<
  "/api/v4/resources/template_values",
  "post"
>;

export interface TemplateValueItem {
  id: string;
  template_name: string;
  schema_field_name: string;
  value: string;
}

export interface TemplateValuesProps {
  template_value_ids?: string[]; // Current template value resource IDs (standardized prop name)
  template_value_resources?: Array<{
    template_value_id: string | null;
    template_id: string | null;
    template_name: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // Selected template value resources (each includes generated field)
  show_template_values?: boolean; // Whether to show this resource picker
  template_value_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  template_values?: Array<{
    template_value_id: string | null;
    template_id: string | null;
    template_name: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // All available template values from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update template_value_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  template_values_agent_id?: string | null; // Agent ID for resource creation
  createTemplateValuesAction?:
    | ((
        input: CreateDraftTemplateValuesIn
      ) => Promise<CreateDraftTemplateValuesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering template values
  showSelectedFilter?: boolean; // Whether to show only selected template values
}

export function TemplateValues({
  template_value_ids,
  template_value_resources: _template_value_resources,
  show_template_values = false,
  template_value_suggestions: _template_value_suggestions,
  template_values,
  disabled = false,
  onChange,
  label = "Template Values",
  id = "template_values",
  required = false,
  placeholder: _placeholder = "Select template values...",
  description,
  group_id,
  template_values_agent_id,
  createTemplateValuesAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
}: TemplateValuesProps) {
  const ids = useMemo(() => template_value_ids ?? [], [template_value_ids]);
  const show = show_template_values ?? false;
  const allTemplateValues = useMemo(() => template_values ?? [], [template_values]);
  const suggestionsList = useMemo(
    () => _template_value_suggestions ?? [],
    [_template_value_suggestions]
  );

  // Track which template value IDs have already had resources created
  const createdTemplateValueIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdTemplateValueIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdTemplateValueIdsRef.current.add(id));
  }, [ids]);

  // Convert template_values array to TemplateValueItem format for SelectableGrid
  const templateValueItems = useMemo(() => {
    return allTemplateValues
      .filter(
        (t) =>
          t.template_value_id &&
          t.template_name &&
          t.schema_field_name &&
          t.value !== null
      ) // Filter out nulls
      .map((t) => ({
        id: t.template_value_id!,
        template_name: t.template_name!,
        schema_field_name: t.schema_field_name!,
        value: t.value!,
      }));
  }, [allTemplateValues]);

  // Filter template values based on search term
  const filteredTemplateValues = useMemo(() => {
    let filtered = templateValueItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const searchText = `${item.template_name} ${item.schema_field_name} ${item.value}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((item) => ids.includes(item.id));
    }

    return filtered;
  }, [templateValueItems, searchTerm, showSelectedFilter, ids]);

  // Check if a template value is suggested
  const isSuggested = useCallback(
    (templateValueId: string) => suggestionsList.includes(templateValueId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (templateValueId: string) => {
      const isSelected = ids.includes(templateValueId);
      let newIds: string[];

      if (isSelected) {
        // Remove template value
        newIds = ids.filter((id) => id !== templateValueId);
        createdTemplateValueIdsRef.current.delete(templateValueId);
      } else {
        // Add template value - create resource if not already created
        newIds = [...ids, templateValueId];

        // Find the template value to get template_id and schema_field_id
        const templateValue = allTemplateValues.find(
          (t) => t.template_value_id === templateValueId
        );

        if (
          !createdTemplateValueIdsRef.current.has(templateValueId) &&
          createTemplateValuesAction &&
          template_values_agent_id &&
          group_id &&
          templateValue &&
          templateValue.template_id &&
          templateValue.schema_field_id &&
          templateValue.value !== null
        ) {
          try {
            // Determine value type and set appropriate field
            // API expects all three as text (nullable), but only one should be set
            const valueStr = templateValue.value;
            let stringValue: string | null = null;
            let numberValue: string | null = null;
            let booleanValue: string | null = null;

            // Try to parse as number first
            const numValue = parseFloat(valueStr);
            if (!isNaN(numValue) && isFinite(numValue)) {
              numberValue = valueStr;
            } else if (valueStr.toLowerCase() === "true" || valueStr.toLowerCase() === "false") {
              booleanValue = valueStr.toLowerCase();
            } else {
              stringValue = valueStr;
            }

            await createTemplateValuesAction({
              body: {
                agent_id: template_values_agent_id,
                group_id: group_id,
                template_id: templateValue.template_id,
                schema_field_id: templateValue.schema_field_id,
                string_value: stringValue,
                number_value: numberValue,
                boolean_value: booleanValue,
                mcp: false,
              },
            });
            createdTemplateValueIdsRef.current.add(templateValueId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create template value resource for ${templateValueId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(newIds);
    },
    [
      ids,
      onChange,
      createTemplateValuesAction,
      template_values_agent_id,
      group_id,
      allTemplateValues,
    ]
  );

  // Check if any template value resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _template_value_resources?.some((t) => t.generated) ?? false;
  }, [_template_value_resources]);

  // Don't render if show_template_values is false (AFTER all hooks)
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
          {onGenerate && template_values_agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
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
        </div>
      )}
      <SelectableGrid<TemplateValueItem>
        items={filteredTemplateValues}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {/* Check icon - top right */}
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {/* Suggested badge - top right */}
            {isSuggested(item.id) && !isSelected && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight">
                {item.template_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Field: {item.schema_field_name} • Value: {item.value}
              </p>
            </div>
          </div>
        )}
        emptyMessage="No template values found."
        disabled={disabled}
      />
    </div>
  );
}
