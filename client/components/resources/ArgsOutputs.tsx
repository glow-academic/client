/**
 * ArgsOutputs.tsx
 * Resource component for args_outputs selection
 * Uses SelectableGrid for args_outputs selection with search/filter support
 * Manages args_outputs_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftArgsOutputsIn = InputOf<"/api/v4/resources/args_outputs", "post">;
type CreateDraftArgsOutputsOut = OutputOf<"/api/v4/resources/args_outputs", "post">;

export interface ArgsOutputItem {
  id: string;
  args_id: string;
  name: string;
  template?: string;
}

export interface ArgsOutputsProps {
  args_outputs_ids?: string[]; // Current args_outputs resource IDs (standardized prop name)
  args_outputs_resources?: Array<{
    id: string | null;
    args_id: string | null;
    name: string | null;
    template?: string | null;
    generated?: boolean | null;
    group_id?: string | null;
  }>; // Selected args_outputs resources (each includes generated and group_id fields)
  show_args_outputs?: boolean; // Whether to show this resource picker
  args_outputs_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  args_outputs?: Array<{
    id: string | null;
    args_id: string | null;
    name: string | null;
    template?: string | null;
    generated?: boolean | null;
    group_id?: string | null;
  }>; // All available args_outputs from API (each includes generated and group_id fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update args_outputs_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createArgsOutputsAction?:
    | ((input: CreateDraftArgsOutputsIn) => Promise<CreateDraftArgsOutputsOut>)
    | undefined;
  searchTerm?: string; // Search term for filtering args_outputs
  showSelectedFilter?: boolean; // Whether to show only selected args_outputs
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  // Args data for showing which args are linked
  args?: Array<{
    id: string | null;
    name: string | null;
  }>;
}

export function ArgsOutputs({
  args_outputs_ids,
  args_outputs_resources: _args_outputs_resources,
  show_args_outputs = false,
  args_outputs_suggestions: _args_outputs_suggestions,
  args_outputs,
  disabled = false,
  onChange,
  label = "Args Outputs",
  id = "args_outputs",
  required = false,
  placeholder: _placeholder = "Select args outputs...",
  description,
  group_id,
  agent_id,
  createArgsOutputsAction,
  searchTerm = "",
  showSelectedFilter = false,
  onGenerate,
  isGenerating = false,
  args = [],
}: ArgsOutputsProps) {
  // Use standardized props
  const ids = useMemo(() => args_outputs_ids ?? [], [args_outputs_ids]);
  const show = show_args_outputs ?? false;
  const allArgsOutputsMemo = useMemo(() => args_outputs ?? [], [args_outputs]);
  const suggestionsList = useMemo(
    () => _args_outputs_suggestions ?? [],
    [_args_outputs_suggestions]
  );

  // Track which args_outputs IDs have already had resources created
  const createdArgsOutputsIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdArgsOutputsIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdArgsOutputsIdsRef.current.add(id));
  }, [ids]);

  // Create a map of args by id for quick lookup
  const argsMap = useMemo(() => {
    const map = new Map<string, string>();
    args.forEach((arg) => {
      if (arg.id && arg.name) {
        map.set(arg.id, arg.name);
      }
    });
    return map;
  }, [args]);

  // Convert args_outputs array to ArgsOutputItem format for SelectableGrid
  const argsOutputItems = useMemo(() => {
    return allArgsOutputsMemo
      .filter((ao) => ao.id && ao.name && ao.args_id) // Filter out nulls
      .map((ao) => ({
        id: ao.id!,
        args_id: ao.args_id!,
        name: ao.name!,
        ...(ao.template && { template: ao.template }),
      }));
  }, [allArgsOutputsMemo]);

  // Filter args_outputs based on search term
  const filteredArgsOutputs = useMemo(() => {
    let filtered = argsOutputItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((ao) => {
        const argName = argsMap.get(ao.args_id) || "";
        const searchText =
          `${ao.name} ${ao.template || ""} ${argName}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((ao) => ids.includes(ao.id));
    }

    return filtered;
  }, [argsOutputItems, searchTerm, showSelectedFilter, ids, argsMap]);

  // Check if an args_output is suggested
  const isSuggested = useCallback(
    (argsOutputId: string) => suggestionsList.includes(argsOutputId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (argsOutputId: string) => {
      const isSelected = ids.includes(argsOutputId);
      let newIds: string[];

      if (isSelected) {
        // Remove args_output
        newIds = ids.filter((id) => id !== argsOutputId);
        createdArgsOutputsIdsRef.current.delete(argsOutputId);
      } else {
        // Add args_output - create resource if not already created
        newIds = [...ids, argsOutputId];

        if (
          !createdArgsOutputsIdsRef.current.has(argsOutputId) &&
          createArgsOutputsAction &&
          agent_id &&
          group_id
        ) {
          // Find the args_output to get its properties
          const argsOutput = argsOutputItems.find((ao) => ao.id === argsOutputId);
          if (argsOutput) {
            try {
              await createArgsOutputsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  args_id: argsOutput.args_id,
                  name: argsOutput.name,
                  template: argsOutput.template || "",
                  mcp: false,
                },
              });
              createdArgsOutputsIdsRef.current.add(argsOutputId);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(
                `Failed to create args_outputs resource for ${argsOutputId}:`,
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
    [ids, onChange, createArgsOutputsAction, agent_id, group_id, argsOutputItems]
  );

  // Don't render if show_args_outputs is false (AFTER all hooks)
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
      <SelectableGrid<ArgsOutputItem>
        items={filteredArgsOutputs}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const argName = argsMap.get(item.args_id) || item.args_id;
          return (
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
                <p className="text-xs text-muted-foreground mt-0.5">
                  Output for: {argName}
                </p>
                {item.template && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Template: {item.template}
                  </p>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No args outputs found."
        disabled={disabled}
      />
    </div>
  );
}
