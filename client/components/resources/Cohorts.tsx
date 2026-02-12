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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

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
  searchTerm?: string;
  showSelectedFilter?: boolean;
  emptyMessage?: string;
  group_id?: string | null;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  cohortIds?: string[];
  // AI diff view props
  aiCohortResources?: Array<{
    cohort_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  searchTerm = "",
  showSelectedFilter = false,
  emptyMessage = "No cohorts found.",
  group_id,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  cohortIds,
  // AI diff view props
  aiCohortResources,
  onAccept,
  onReject,
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

  // AI suggestion state
  const showDiff = !!aiCohortResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiCohortResources
          ?.map((c) => c.cohort_id)
          .filter(Boolean) as string[]
      ),
    [aiCohortResources]
  );

  const cohortItems = useMemo(() => {
    return allCohorts
      .filter((c) => c.cohort_id && c.name)
      .map((c) => ({
        id: c.cohort_id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}),
      }));
  }, [allCohorts]);

  const displayCohorts = useMemo(() => {
    let filtered = cohortItems;
    const trimmedSearch = searchTerm.trim().toLowerCase();

    if (trimmedSearch) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(trimmedSearch) ||
          c.description?.toLowerCase().includes(trimmedSearch)
      );
    }

    if (showSelectedFilter) {
      filtered = filtered.filter((c) => ids.includes(c.id));
    }

    return [...filtered].sort((a, b) => {
      const aSelected = ids.includes(a.id);
      const bSelected = ids.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [cohortItems, searchTerm, showSelectedFilter, ids]);

  const isSuggested = useCallback(
    (cohortId: string) => suggestionsList.includes(cohortId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (cohortId: string) => {
      const isSelected = ids.includes(cohortId);
      const newIds = isSelected
        ? ids.filter((id) => id !== cohortId)
        : [...ids, cohortId];

      onChange(newIds);
    },
    [ids, onChange]
  );

  const hasGenerated = useMemo(() => {
    return cohort_resources?.some((c) => c.generated) ?? false;
  }, [cohort_resources]);

  // Accept AI suggestion - add AI-suggested cohorts to selection
  const handleAccept = useCallback(() => {
    if (!aiCohortResources?.length) return;
    const newIds = aiCohortResources
      .map((c) => c.cohort_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiCohortResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}
      <SelectableGrid<CohortItem>
        horizontal
        items={displayCohorts}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
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
        );
        }}
        emptyMessage={emptyMessage}
        disabled={disabled}
      />
    </div>
  );
}
