/**
 * Fields.tsx
 * Resource component for field selection
 * Uses SelectableGrid for field selection with search/filter support
 * Manages field_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<"/api/v4/resources/fields", "post">;

export interface FieldItem {
  id: string;
  name: string;
  description?: string;
}

export interface FieldsProps {
  field_ids?: string[]; // Current field resource IDs (standardized prop name)
  field_resources?: Array<{
    field_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected field resources (each includes generated field)
  show_fields?: boolean; // Whether to show this resource picker
  field_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  fields?: Array<{
    field_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available fields from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update field_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createFieldsAction?:
    | ((input: CreateDraftFieldsIn) => Promise<CreateDraftFieldsOut>)
    | undefined;
  searchTerm?: string; // Search term for filtering fields
  showSelectedFilter?: boolean; // Whether to show only selected fields
  // Legacy props for backward compatibility
  fieldIds?: string[];
}

export function Fields({
  field_ids,
  field_resources: _field_resources,
  show_fields = false,
  field_suggestions: _field_suggestions,
  fields,
  disabled = false,
  onChange,
  label = "Fields",
  id = "fields",
  required = false,
  placeholder: _placeholder = "Select fields...",
  description,
  group_id,
  agent_id,
  createFieldsAction,
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

  // Track which field IDs have already had resources created
  const createdFieldIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdFieldIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdFieldIdsRef.current.add(id));
  }, [ids]);

  // Convert fields array to FieldItem format for SelectableGrid
  const fieldItems = useMemo(() => {
    return allFieldsMemo
      .filter((f) => f.field_id && f.name) // Filter out nulls
      .map((f) => ({
        id: f.field_id!,
        name: f.name!,
        ...(f.description && { description: f.description }),
      }));
  }, [allFieldsMemo]);

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
    async (fieldId: string) => {
      const isSelected = ids.includes(fieldId);
      let newIds: string[];

      if (isSelected) {
        // Remove field
        newIds = ids.filter((id) => id !== fieldId);
        createdFieldIdsRef.current.delete(fieldId);
      } else {
        // Add field - create resource if not already created
        newIds = [...ids, fieldId];

        if (
          !createdFieldIdsRef.current.has(fieldId) &&
          createFieldsAction &&
          agent_id &&
          group_id
        ) {
          try {
            await createFieldsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                field_id: fieldId,
                mcp: false,
              },
            });
            createdFieldIdsRef.current.add(fieldId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create field resource for ${fieldId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(newIds);
    },
    [ids, onChange, createFieldsAction, agent_id, group_id]
  );

  // Don't render if show_fields is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2 min-w-0 w-full">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <SelectableGrid<FieldItem>
        items={filteredFields}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {/* Check icon - top right */}
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}

            {/* Suggested badge - top right */}
            {isSuggested(item.id) && !isSelected && (
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
        )}
        emptyMessage="No fields found."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
