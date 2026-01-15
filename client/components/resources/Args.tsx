/**
 * Args.tsx
 * Resource component for args selection
 * Uses SelectableGrid for args selection with search/filter support
 * Manages args_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;

export interface ArgItem {
  id: string;
  name: string;
  description?: string;
  field_type?: string;
  required?: boolean;
  default_value?: string;
  position?: number;
}

export interface ArgsProps {
  args_ids?: string[]; // Current args resource IDs (standardized prop name)
  args_resources?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
    field_type?: string | null;
    required?: boolean | null;
    default_value?: string | null;
    position?: number | null;
    generated?: boolean | null;
    group_id?: string | null;
  }>; // Selected args resources (each includes generated and group_id fields)
  show_args?: boolean; // Whether to show this resource picker
  args_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  args?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
    field_type?: string | null;
    required?: boolean | null;
    default_value?: string | null;
    position?: number | null;
    generated?: boolean | null;
    group_id?: string | null;
  }>; // All available args from API (each includes generated and group_id fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update args_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createArgsAction?:
    | ((input: CreateDraftArgsIn) => Promise<CreateDraftArgsOut>)
    | undefined;
  searchTerm?: string; // Search term for filtering args
  showSelectedFilter?: boolean; // Whether to show only selected args
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
}

export function Args({
  args_ids,
  args_resources: _args_resources,
  show_args = false,
  args_suggestions: _args_suggestions,
  args,
  disabled = false,
  onChange,
  label = "Args",
  id = "args",
  required = false,
  placeholder: _placeholder = "Select args...",
  description,
  group_id,
  agent_id,
  createArgsAction,
  searchTerm = "",
  showSelectedFilter = false,
  onGenerate,
  isGenerating = false,
}: ArgsProps) {
  // Use standardized props
  const ids = useMemo(() => args_ids ?? [], [args_ids]);
  const show = show_args ?? false;
  const allArgsMemo = useMemo(() => args ?? [], [args]);
  const suggestionsList = useMemo(
    () => _args_suggestions ?? [],
    [_args_suggestions]
  );

  // Track which args IDs have already had resources created
  const createdArgsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdArgsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdArgsIdsRef.current.add(id));
  }, [ids]);

  // Convert args array to ArgItem format for SelectableGrid
  const argItems = useMemo(() => {
    return allArgsMemo
      .filter((a) => a.id && a.name) // Filter out nulls
      .map((a) => ({
        id: a.id!,
        name: a.name!,
        ...(a.description && { description: a.description }),
        ...(a.field_type && { field_type: a.field_type }),
        ...(a.required !== null && a.required !== undefined && { required: a.required }),
        ...(a.default_value && { default_value: a.default_value }),
        ...(a.position !== null && a.position !== undefined && { position: a.position }),
      }));
  }, [allArgsMemo]);

  // Filter args based on search term
  const filteredArgs = useMemo(() => {
    let filtered = argItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((arg) => {
        const searchText =
          `${arg.name} ${arg.description || ""} ${arg.field_type || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((arg) => ids.includes(arg.id));
    }

    return filtered;
  }, [argItems, searchTerm, showSelectedFilter, ids]);

  // Check if an arg is suggested
  const isSuggested = useCallback(
    (argId: string) => suggestionsList.includes(argId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (argId: string) => {
      const isSelected = ids.includes(argId);
      let newIds: string[];

      if (isSelected) {
        // Remove arg
        newIds = ids.filter((id) => id !== argId);
        createdArgsIdsRef.current.delete(argId);
      } else {
        // Add arg - create resource if not already created
        newIds = [...ids, argId];

        if (
          !createdArgsIdsRef.current.has(argId) &&
          createArgsAction &&
          agent_id &&
          group_id
        ) {
          // Find the arg to get its properties
          const arg = argItems.find((a) => a.id === argId);
          if (arg) {
            try {
              await createArgsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  name: arg.name,
                  description: arg.description || "",
                  field_type: (arg.field_type || "string") as "string" | "number" | "boolean" | "array",
                  required: arg.required || false,
                  default_value: arg.default_value || "",
                  position_value: arg.position || 0,
                  mcp: false,
                },
              });
              createdArgsIdsRef.current.add(argId);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(
                `Failed to create args resource for ${argId}:`,
                error
              );
              // Don't block UI - still update selection
            }
          }
        }
      }

      // Update parent state
      onChange(newIds);
    },
    [ids, onChange, createArgsAction, agent_id, group_id, argItems]
  );

  // Don't render if show_args is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
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
      <SelectableGrid<ArgItem>
        items={filteredArgs}
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
              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {item.field_type && (
                  <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                    {item.field_type}
                  </span>
                )}
                {item.required && (
                  <span className="text-xs text-destructive">Required</span>
                )}
                {item.default_value && (
                  <span className="text-xs text-muted-foreground">
                    Default: {item.default_value}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        emptyMessage="No args found."
        disabled={disabled}
      />
    </div>
  );
}
