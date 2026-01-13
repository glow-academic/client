/**
 * Cohorts.tsx
 * Resource component for cohort selection
 * Uses GenericPicker to select existing cohort resources
 * Manages cohort_ids array and reports to parent
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

type CreateDraftCohortsIn = InputOf<
  "/api/v4/resources/cohorts",
  "post"
>;
type CreateDraftCohortsOut = OutputOf<
  "/api/v4/resources/cohorts",
  "post"
>;

export interface CohortItem {
  id: string;
  name: string;
  description?: string;
}

export interface CohortsProps {
  cohort_ids?: string[]; // Current cohort resource IDs (standardized prop name)
  cohort_resources?: Array<{
    cohort_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected cohort resources (each includes generated field)
  show_cohorts?: boolean; // Whether to show this resource picker
  cohort_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  cohorts?: Array<{
    cohort_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available cohorts from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update cohort_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createCohortsAction?:
    | ((input: CreateDraftCohortsIn) => Promise<CreateDraftCohortsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Legacy props for backward compatibility
  cohortIds?: string[];
}

export function Cohorts({
  cohort_ids,
  cohort_resources,
  show_cohorts = false,
  cohort_suggestions,
  cohorts,
  disabled = false,
  onChange,
  label = "Cohorts",
  id = "cohorts",
  required = false,
  placeholder = "Select cohorts...",
  description,
  group_id,
  agent_id,
  createCohortsAction,
  onGenerate,
  isGenerating = false,
  // Legacy props for backward compatibility
  cohortIds,
}: CohortsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => cohort_ids ?? cohortIds ?? [],
    [cohort_ids, cohortIds]
  );
  const show = show_cohorts ?? false;
  const allCohorts = useMemo(() => cohorts ?? [], [cohorts]);
  const suggestionsList = useMemo(
    () => cohort_suggestions ?? [],
    [cohort_suggestions]
  );

  // Track which cohort IDs have already had resources created
  const createdCohortIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdCohortIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdCohortIdsRef.current.add(id));
  }, [ids]);

  // Convert cohorts array to CohortItem format for GenericPicker
  const cohortItems = useMemo(() => {
    return allCohorts
      .filter((c) => c.cohort_id && c.name) // Filter out nulls
      .map((c) => ({
        id: c.cohort_id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}), // Only include if not null/undefined
      }));
  }, [allCohorts]);

  // Check if a cohort is suggested
  const isSuggested = useCallback(
    (cohortId: string) => suggestionsList.includes(cohortId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdCohortIdsRef.current.has(id)
      );

      // Create resources for newly selected cohorts
      if (
        newlySelected.length > 0 &&
        createCohortsAction &&
        agent_id &&
        group_id
      ) {
        for (const cohortId of newlySelected) {
          try {
            await createCohortsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                cohort_id: cohortId,
                mcp: false,
              },
            });
            createdCohortIdsRef.current.add(cohortId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create cohort resource for ${cohortId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createCohortsAction, agent_id, group_id]
  );

  // Check if any cohort resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return cohort_resources?.some((c) => c.generated) ?? false;
  }, [cohort_resources]);

  // Don't render if show_cohorts is false (AFTER all hooks)
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
      <GenericPicker<CohortItem>
        items={cohortItems}
        itemIds={allCohorts
          .map((c) => c.cohort_id)
          .filter((id): id is string => id !== null)} // All cohort IDs from array, filter nulls
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
