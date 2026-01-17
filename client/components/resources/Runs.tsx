/**
 * Runs.tsx
 * Resource component for run selection
 * Uses GenericPicker to select existing run resources
 * Manages run_ids array and reports to parent
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

type CreateDraftRunsIn = InputOf<"/api/v4/resources/runs", "post">;
type CreateDraftRunsOut = OutputOf<"/api/v4/resources/runs", "post">;

export interface RunItem {
  id: string;
  name: string;
  description?: string;
}

export interface RunsProps {
  run_ids?: string[]; // Current run resource IDs (standardized prop name)
  run_resources?: Array<{
    run_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected run resources (each includes generated field)
  show_runs?: boolean; // Whether to show this resource picker
  run_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  runs?: Array<{
    run_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available runs from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update run_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createRunsAction?:
    | ((input: CreateDraftRunsIn) => Promise<CreateDraftRunsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Runs({
  run_ids,
  run_resources,
  show_runs = false,
  run_suggestions,
  runs,
  disabled = false,
  onChange,
  label = "Runs",
  id = "runs",
  required = false,
  placeholder = "Select runs...",
  description,
  group_id,
  agent_id,
  createRunsAction,
  onGenerate,
  isGenerating = false,
}: RunsProps) {
  const ids = useMemo(() => run_ids ?? [], [run_ids]);
  const show = show_runs ?? false;
  const allRuns = useMemo(() => runs ?? [], [runs]);
  const suggestionsList = useMemo(
    () => run_suggestions ?? [],
    [run_suggestions]
  );

  // Track which run IDs have already had resources created
  const createdRunIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdRunIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdRunIdsRef.current.add(id));
  }, [ids]);

  // Convert runs array to RunItem format for GenericPicker
  const runItems = useMemo(() => {
    return allRuns
      .filter((r) => r.run_id && r.name) // Filter out nulls
      .map((r) => ({
        id: r.run_id!,
        name: r.name!,
        ...(r.description ? { description: r.description } : {}),
      }));
  }, [allRuns]);

  // Check if a run is suggested
  const isSuggested = useCallback(
    (runId: string) => suggestionsList.includes(runId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdRunIdsRef.current.has(id)
      );

      // Create resources for newly selected runs
      if (
        newlySelected.length > 0 &&
        createRunsAction &&
        agent_id &&
        group_id
      ) {
        for (const runId of newlySelected) {
          try {
            await createRunsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                run_id: runId,
                mcp: false,
              },
            });
            createdRunIdsRef.current.add(runId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create run resource for ${runId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createRunsAction, agent_id, group_id]
  );

  // Check if any run resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return run_resources?.some((r) => r.generated) ?? false;
  }, [run_resources]);

  // Don't render if show_runs is false (AFTER all hooks)
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
          {onGenerate && agent_id && (
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
      <GenericPicker<RunItem>
        items={runItems}
        itemIds={allRuns
          .map((r) => r.run_id)
          .filter((id): id is string => id !== null)} // All run IDs from array, filter nulls
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
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
