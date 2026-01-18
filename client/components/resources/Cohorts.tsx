/**
 * Cohorts.tsx
 * Resource component for cohort selection
 * Uses SelectableGrid for grid card layout (like Simulations.tsx)
 * Manages cohort_ids array and reports to parent
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

type CreateDraftCohortsIn = InputOf<"/api/v4/resources/cohorts", "post">;
type CreateDraftCohortsOut = OutputOf<"/api/v4/resources/cohorts", "post">;

export interface CohortItem {
  id: string;
  name: string;
  description?: string;
}

export interface CohortsProps {
  cohort_ids?: string[];
  cohort_resources?: Array<{
    cohort_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  show_cohorts?: boolean;
  cohort_suggestions?: string[];
  cohorts?: Array<{
    cohort_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createCohortsAction?:
    | ((input: CreateDraftCohortsIn) => Promise<CreateDraftCohortsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
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
  cohortIds,
}: CohortsProps) {
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

  const createdCohortIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ids.forEach((id) => createdCohortIdsRef.current.add(id));
  }, [ids]);

  const cohortItems = useMemo(() => {
    return allCohorts
      .filter((c) => c.cohort_id && c.name)
      .map((c) => ({
        id: c.cohort_id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}),
      }));
  }, [allCohorts]);

  const isSuggested = useCallback(
    (cohortId: string) => suggestionsList.includes(cohortId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (cohortId: string) => {
      const isSelected = ids.includes(cohortId);
      const newIds = isSelected
        ? ids.filter((id) => id !== cohortId)
        : [...ids, cohortId];

      const newlySelected = newIds.filter(
        (id) => !ids.includes(id) && !createdCohortIdsRef.current.has(id)
      );

      if (
        newlySelected.length > 0 &&
        createCohortsAction &&
        agent_id &&
        group_id
      ) {
        for (const cId of newlySelected) {
          try {
            await createCohortsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                cohort_id: cId,
                mcp: false,
              },
            });
            createdCohortIdsRef.current.add(cId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create cohort resource for ${cId}:`,
              error
            );
          }
        }
      }

      onChange(newIds);
    },
    [ids, onChange, createCohortsAction, agent_id, group_id]
  );

  const hasGenerated = useMemo(() => {
    return cohort_resources?.some((c) => c.generated) ?? false;
  }, [cohort_resources]);

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
      <SelectableGrid<CohortItem>
        items={cohortItems}
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
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {isSuggested(item.id) && !isSelected && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )}
        emptyMessage="No cohorts found."
        disabled={disabled}
      />
    </div>
  );
}
