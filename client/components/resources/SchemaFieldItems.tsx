/**
 * SchemaFieldItems.tsx
 * Resource component for schema field item selection
 * Uses SelectableGrid for card-based selection with search/filter support
 * Manages schema_field_item_ids array and reports to parent
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

type CreateDraftSchemaFieldItemsIn = InputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;
type CreateDraftSchemaFieldItemsOut = OutputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;

export interface SchemaFieldItemItem {
  id: string;
  schema_field_name: string;
  item_schema_id: string;
}

export interface SchemaFieldItemsProps {
  schema_field_item_ids?: string[]; // Current schema field item resource IDs (standardized prop name)
  schema_field_item_resources?: Array<{
    schema_field_item_id: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    item_schema_id: string | null;
    generated?: boolean | null;
  }>; // Selected schema field item resources (each includes generated field)
  show_schema_field_items?: boolean; // Whether to show this resource picker
  schema_field_item_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  schema_field_items?: Array<{
    schema_field_item_id: string | null;
    schema_field_id: string | null;
    schema_field_name: string | null;
    item_schema_id: string | null;
    generated?: boolean | null;
  }>; // All available schema field items from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update schema_field_item_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  schema_field_items_agent_id?: string | null; // Agent ID for resource creation
  createSchemaFieldItemsAction?:
    | ((
        input: CreateDraftSchemaFieldItemsIn
      ) => Promise<CreateDraftSchemaFieldItemsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering schema field items
  showSelectedFilter?: boolean; // Whether to show only selected schema field items
}

export function SchemaFieldItems({
  schema_field_item_ids,
  schema_field_item_resources: _schema_field_item_resources,
  show_schema_field_items = false,
  schema_field_item_suggestions: _schema_field_item_suggestions,
  schema_field_items,
  disabled = false,
  onChange,
  label = "Schema Field Items",
  id = "schema_field_items",
  required = false,
  placeholder: _placeholder = "Select schema field items...",
  description,
  group_id,
  schema_field_items_agent_id,
  createSchemaFieldItemsAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
}: SchemaFieldItemsProps) {
  const ids = useMemo(() => schema_field_item_ids ?? [], [schema_field_item_ids]);
  const show = show_schema_field_items ?? false;
  const allSchemaFieldItems = useMemo(() => schema_field_items ?? [], [schema_field_items]);
  const suggestionsList = useMemo(
    () => _schema_field_item_suggestions ?? [],
    [_schema_field_item_suggestions]
  );

  // Track which schema field item IDs have already had resources created
  const createdSchemaFieldItemIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdSchemaFieldItemIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdSchemaFieldItemIdsRef.current.add(id));
  }, [ids]);

  // Convert schema_field_items array to SchemaFieldItemItem format for SelectableGrid
  const schemaFieldItemItems = useMemo(() => {
    return allSchemaFieldItems
      .filter(
        (s) =>
          s.schema_field_item_id &&
          s.schema_field_name &&
          s.item_schema_id
      ) // Filter out nulls
      .map((s) => ({
        id: s.schema_field_item_id!,
        schema_field_name: s.schema_field_name!,
        item_schema_id: s.item_schema_id!,
      }));
  }, [allSchemaFieldItems]);

  // Filter schema field items based on search term
  const filteredSchemaFieldItems = useMemo(() => {
    let filtered = schemaFieldItemItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const searchText = `${item.schema_field_name} ${item.item_schema_id}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((item) => ids.includes(item.id));
    }

    return filtered;
  }, [schemaFieldItemItems, searchTerm, showSelectedFilter, ids]);

  // Check if a schema field item is suggested
  const isSuggested = useCallback(
    (schemaFieldItemId: string) => suggestionsList.includes(schemaFieldItemId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (schemaFieldItemId: string) => {
      const isSelected = ids.includes(schemaFieldItemId);
      let newIds: string[];

      if (isSelected) {
        // Remove schema field item
        newIds = ids.filter((id) => id !== schemaFieldItemId);
        createdSchemaFieldItemIdsRef.current.delete(schemaFieldItemId);
      } else {
        // Add schema field item - create resource if not already created
        newIds = [...ids, schemaFieldItemId];

        // Find the schema field item to get schema_field_id and item_schema_id
        const schemaFieldItem = allSchemaFieldItems.find(
          (s) => s.schema_field_item_id === schemaFieldItemId
        );

        if (
          !createdSchemaFieldItemIdsRef.current.has(schemaFieldItemId) &&
          createSchemaFieldItemsAction &&
          schema_field_items_agent_id &&
          group_id &&
          schemaFieldItem &&
          schemaFieldItem.schema_field_id &&
          schemaFieldItem.item_schema_id
        ) {
          try {
            await createSchemaFieldItemsAction({
              body: {
                agent_id: schema_field_items_agent_id,
                group_id: group_id,
                schema_field_id: schemaFieldItem.schema_field_id,
                item_schema_id: schemaFieldItem.item_schema_id,
                mcp: false,
              },
            });
            createdSchemaFieldItemIdsRef.current.add(schemaFieldItemId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create schema field item resource for ${schemaFieldItemId}:`,
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
      createSchemaFieldItemsAction,
      schema_field_items_agent_id,
      group_id,
      allSchemaFieldItems,
    ]
  );

  // Check if any schema field item resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _schema_field_item_resources?.some((s) => s.generated) ?? false;
  }, [_schema_field_item_resources]);

  // Don't render if show_schema_field_items is false (AFTER all hooks)
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
          {onGenerate && schema_field_items_agent_id && (
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
      <SelectableGrid<SchemaFieldItemItem>
        items={filteredSchemaFieldItems}
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
                {item.schema_field_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Item Schema: {item.item_schema_id.slice(0, 8)}...
              </p>
            </div>
          </div>
        )}
        emptyMessage="No schema field items found."
        disabled={disabled}
      />
    </div>
  );
}
