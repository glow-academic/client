/**
 * Schemas.tsx
 * Resource component for schema selection
 * Uses GenericPicker to select existing schema resources
 * Manages schema_ids array and reports to parent
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
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftSchemasIn = InputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftSchemasOut = OutputOf<"/api/v4/resources/schemas", "post">;

export interface SchemaItem {
  id: string;
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

  // Convert schemas array to SchemaItem format for GenericPicker
  const schemaItems = useMemo(() => {
    return allSchemas
      .filter((s) => s.schema_id) // Filter out nulls
      .map((s) => ({
        id: s.schema_id!,
      }));
  }, [allSchemas]);

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
      <GenericPicker<SchemaItem>
        items={schemaItems}
        itemIds={allSchemas
          .map((s) => s.schema_id)
          .filter((id): id is string => id !== null)} // All schema IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.id} // Use ID as label since schemas don't have names
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.id}</div>
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
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
