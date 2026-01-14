/**
 * TemplateArrayItems.tsx
 * Resource component for template array item selection
 * Uses SelectableGrid for card-based selection with search/filter support
 * Manages template_array_item_ids array and reports to parent
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

type CreateDraftTemplateArrayItemsIn = InputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;
type CreateDraftTemplateArrayItemsOut = OutputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;

export interface TemplateArrayItemItem {
  id: string;
  template_name: string;
  schema_field_name: string;
  item_template_name: string;
}

export interface TemplateArrayItemsProps {
  template_array_item_ids?: string[]; // Current template array item resource IDs (standardized prop name)
  template_array_item_resources?: Array<{
    template_array_item_id: string | null;
    template_id: string | null;
    template_name: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    item_template_id: string | null;
    item_template_name: string | null;
    generated?: boolean | null;
  }>; // Selected template array item resources (each includes generated field)
  show_template_array_items?: boolean; // Whether to show this resource picker
  template_array_item_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  template_array_items?: Array<{
    template_array_item_id: string | null;
    template_id: string | null;
    template_name: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    item_template_id: string | null;
    item_template_name: string | null;
    generated?: boolean | null;
  }>; // All available template array items from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update template_array_item_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  template_array_items_agent_id?: string | null; // Agent ID for resource creation
  createTemplateArrayItemsAction?:
    | ((
        input: CreateDraftTemplateArrayItemsIn
      ) => Promise<CreateDraftTemplateArrayItemsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering template array items
  showSelectedFilter?: boolean; // Whether to show only selected template array items
}

export function TemplateArrayItems({
  template_array_item_ids,
  template_array_item_resources: _template_array_item_resources,
  show_template_array_items = false,
  template_array_item_suggestions: _template_array_item_suggestions,
  template_array_items,
  disabled = false,
  onChange,
  label = "Template Array Items",
  id = "template_array_items",
  required = false,
  placeholder: _placeholder = "Select template array items...",
  description,
  group_id,
  template_array_items_agent_id,
  createTemplateArrayItemsAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
}: TemplateArrayItemsProps) {
  const ids = useMemo(() => template_array_item_ids ?? [], [template_array_item_ids]);
  const show = show_template_array_items ?? false;
  const allTemplateArrayItems = useMemo(() => template_array_items ?? [], [template_array_items]);
  const suggestionsList = useMemo(
    () => _template_array_item_suggestions ?? [],
    [_template_array_item_suggestions]
  );

  // Track which template array item IDs have already had resources created
  const createdTemplateArrayItemIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdTemplateArrayItemIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdTemplateArrayItemIdsRef.current.add(id));
  }, [ids]);

  // Convert template_array_items array to TemplateArrayItemItem format for SelectableGrid
  const templateArrayItemItems = useMemo(() => {
    return allTemplateArrayItems
      .filter(
        (t) =>
          t.template_array_item_id &&
          t.template_name &&
          t.schema_field_name &&
          t.item_template_name
      ) // Filter out nulls
      .map((t) => ({
        id: t.template_array_item_id!,
        template_name: t.template_name!,
        schema_field_name: t.schema_field_name!,
        item_template_name: t.item_template_name!,
      }));
  }, [allTemplateArrayItems]);

  // Filter template array items based on search term
  const filteredTemplateArrayItems = useMemo(() => {
    let filtered = templateArrayItemItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const searchText = `${item.template_name} ${item.schema_field_name} ${item.item_template_name}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((item) => ids.includes(item.id));
    }

    return filtered;
  }, [templateArrayItemItems, searchTerm, showSelectedFilter, ids]);

  // Check if a template array item is suggested
  const isSuggested = useCallback(
    (templateArrayItemId: string) => suggestionsList.includes(templateArrayItemId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (templateArrayItemId: string) => {
      const isSelected = ids.includes(templateArrayItemId);
      let newIds: string[];

      if (isSelected) {
        // Remove template array item
        newIds = ids.filter((id) => id !== templateArrayItemId);
        createdTemplateArrayItemIdsRef.current.delete(templateArrayItemId);
      } else {
        // Add template array item - create resource if not already created
        newIds = [...ids, templateArrayItemId];

        // Find the template array item to get template_id, schema_field_id, and item_template_id
        const templateArrayItem = allTemplateArrayItems.find(
          (t) => t.template_array_item_id === templateArrayItemId
        );

        if (
          !createdTemplateArrayItemIdsRef.current.has(templateArrayItemId) &&
          createTemplateArrayItemsAction &&
          template_array_items_agent_id &&
          group_id &&
          templateArrayItem &&
          templateArrayItem.template_id &&
          templateArrayItem.schema_field_id &&
          templateArrayItem.item_template_id
        ) {
          try {
            await createTemplateArrayItemsAction({
              body: {
                agent_id: template_array_items_agent_id,
                group_id: group_id,
                template_id: templateArrayItem.template_id,
                schema_field_id: templateArrayItem.schema_field_id,
                item_template_id: templateArrayItem.item_template_id,
                mcp: false,
              },
            });
            createdTemplateArrayItemIdsRef.current.add(templateArrayItemId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create template array item resource for ${templateArrayItemId}:`,
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
      createTemplateArrayItemsAction,
      template_array_items_agent_id,
      group_id,
      allTemplateArrayItems,
    ]
  );

  // Check if any template array item resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _template_array_item_resources?.some((t) => t.generated) ?? false;
  }, [_template_array_item_resources]);

  // Don't render if show_template_array_items is false (AFTER all hooks)
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
          {onGenerate && template_array_items_agent_id && (
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
      <SelectableGrid<TemplateArrayItemItem>
        items={filteredTemplateArrayItems}
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
                Field: {item.schema_field_name} • Item: {item.item_template_name}
              </p>
            </div>
          </div>
        )}
        emptyMessage="No template array items found."
        disabled={disabled}
      />
    </div>
  );
}
