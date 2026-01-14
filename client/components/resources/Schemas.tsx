/**
 * Schemas.tsx
 * Resource component for schema selection
 * Uses GenericPicker to select existing schema resources
 * Manages schema_ids array and reports to parent
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

type CreateDraftSchemasIn = InputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftSchemasOut = OutputOf<"/api/v4/resources/schemas", "post">;

export interface SchemaItem {
  id: string;
  field_count?: number;
}

export interface SchemasProps {
  schema_ids?: string[]; // Current schema resource IDs (standardized prop name)
  schema_resources?: Array<{
    schema_id: string | null;
    generated?: boolean | null;
  }>; // Selected schema resources (each includes generated field)
  show_schemas?: boolean; // Whether to show this resource picker
  schema_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  schemas?: Array<{
    schema_id: string | null;
    field_count?: number | null;
    generated?: boolean | null;
  }>; // All available schemas from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update schema_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  schemas_agent_id?: string | null; // Agent ID for resource creation
  createSchemasAction?:
    | ((input: CreateDraftSchemasIn) => Promise<CreateDraftSchemasOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering schemas
  showSelectedFilter?: boolean; // Whether to show only selected schemas
}

export function Schemas({
  schema_ids,
  schema_resources,
  show_schemas = false,
  schema_suggestions,
  schemas,
  disabled = false,
  onChange,
  label = "Schemas",
  id = "schemas",
  required = false,
  placeholder = "Select schemas...",
  description,
  group_id,
  schemas_agent_id,
  createSchemasAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
}: SchemasProps) {
  const ids = useMemo(() => schema_ids ?? [], [schema_ids]);
  const show = show_schemas ?? false;
  const allSchemas = useMemo(() => schemas ?? [], [schemas]);
  const suggestionsList = useMemo(
    () => schema_suggestions ?? [],
    [schema_suggestions]
  );

  // Track which schema IDs have already had resources created
  const createdSchemaIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdSchemaIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdSchemaIdsRef.current.add(id));
  }, [ids]);

  // Convert schemas array to SchemaItem format for SelectableGrid
  const schemaItems = useMemo(() => {
    return allSchemas
      .filter((s) => s.schema_id) // Filter out nulls
      .map((s) => ({
        id: s.schema_id!,
        ...(s.field_count !== null && s.field_count !== undefined && { field_count: s.field_count }),
      }));
  }, [allSchemas]);

  // Filter schemas based on search term
  const filteredSchemas = useMemo(() => {
    let filtered = schemaItems;

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((schema) => {
        const searchText = `${schema.id} ${schema.field_count ?? 0} fields`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((schema) => ids.includes(schema.id));
    }

    return filtered;
  }, [schemaItems, searchTerm, showSelectedFilter, ids]);

  // Check if a schema is suggested
  const isSuggested = useCallback(
    (schemaId: string) => suggestionsList.includes(schemaId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdSchemaIdsRef.current.has(id)
      );

      // Create resources for newly selected schemas
      if (
        newlySelected.length > 0 &&
        createSchemasAction &&
        schemas_agent_id &&
        group_id
      ) {
        for (const schemaId of newlySelected) {
          try {
            await createSchemasAction({
              body: {
                agent_id: schemas_agent_id,
                group_id: group_id,
                schema_id: schemaId,
                mcp: false,
              },
            });
            createdSchemaIdsRef.current.add(schemaId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create schema resource for ${schemaId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createSchemasAction, schemas_agent_id, group_id]
  );

  // Check if any schema resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return schema_resources?.some((s) => s.generated) ?? false;
  }, [schema_resources]);

  // Don't render if show_schemas is false (AFTER all hooks)
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
          {onGenerate && schemas_agent_id && (
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
      <SelectableGrid<SchemaItem>
        items={filteredSchemas}
        selectedId={null}
        selectedIds={ids}
        onSelect={(schemaId) => {
          const isSelected = ids.includes(schemaId);
          const newIds = isSelected
            ? ids.filter((id) => id !== schemaId)
            : [...ids, schemaId];
          handleSelect(newIds);
        }}
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
                {item.id.slice(0, 8)}...
              </h3>
              {item.field_count !== undefined && item.field_count !== null && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.field_count} {item.field_count === 1 ? "field" : "fields"}
                </p>
              )}
            </div>
          </div>
        )}
        emptyMessage="No schemas found."
        disabled={disabled}
      />
    </div>
  );
}
