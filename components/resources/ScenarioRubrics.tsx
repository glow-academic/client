/**
 * ScenarioRubrics.tsx
 * Resource component for per-scenario rubric selection
 * Uses base rubrics list and creates scenario_rubrics_resource entries
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
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ScenarioRubricResourceItem {
  id?: string | null;
  scenario_id?: string | null;
  rubric_id?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface ScenarioRubricsProps {
  scenario_rubric_resources?: ScenarioRubricResourceItem[];
  show_scenario_rubrics?: boolean;
  rubrics?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  scenario_ids?: string[];
  scenarios?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
  }>;
  scenario_resources?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  /** Value callback for unified draft — reports all scenario+rubric pairs */
  onScenarioRubricValues?: (rubrics: Array<{ scenario_id: string; rubric_id: string }>) => void;
}

const NONE_OPTION = "__none__";

type ScenarioRubricOption = {
  id: string;
  name: string;
  description?: string;
  isNone?: boolean;
};

export function ScenarioRubrics({
  scenario_rubric_resources,
  show_scenario_rubrics = false,
  rubrics,
  scenario_ids = [],
  scenarios,
  scenario_resources,
  disabled = false,
  onChange,
  label = "Scenario Rubrics",
  id = "scenario_rubrics",
  required = false,
  description,
  onScenarioRubricValues,
}: ScenarioRubricsProps) {
  const show = show_scenario_rubrics ?? false;
  const currentResources = useMemo(
    () => scenario_rubric_resources ?? [],
    [scenario_rubric_resources],
  );
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return currentResources.filter((r) => r.pending && r.scenario_id);
  }, [currentResources]);
  const showDiff = pendingItems.length > 0;
  const pendingScenarioIds = useMemo(
    () => new Set(pendingItems.map((r) => r.scenario_id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const scenarioLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full scenarios list as base (keyed by scenario_id to match scenario_ids)
    // Handle both naming conventions: API returns scenario_id/title, but we also support id/name
    (scenarios ?? []).forEach((scenario) => {
      const id = scenario.scenario_id || scenario.id;
      if (id) {
        const name = (scenario.title || scenario.name)?.trim() || null;
        const desc = scenario.description?.trim() || null;
        if (name || desc) {
          map.set(id, name || desc || "Untitled scenario");
        }
      }
    });
    // Override with scenario_resources (server-confirmed data takes priority)
    (scenario_resources ?? []).forEach((scenario) => {
      const id = scenario.scenario_id || scenario.id;
      if (id) {
        const name = (scenario.title || scenario.name)?.trim() || "";
        const descriptionText = scenario.description?.trim() || "";
        map.set(id, name || descriptionText || "Untitled scenario");
      }
    });
    return map;
  }, [scenarios, scenario_resources]);

  const [rubricIdByScenario, setRubricIdByScenario] = useState<
    Map<string, string | null>
  >(new Map());
  const [scenarioRubricIdsByScenario, setScenarioRubricIdsByScenario] =
    useState<Map<string, string>>(new Map());
  useEffect(() => {
    const nextRubrics = new Map<string, string | null>();
    const nextIds = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.scenario_id) {
        nextRubrics.set(resource.scenario_id, resource.rubric_id ?? null);
        if (resource.id) {
          nextIds.set(resource.scenario_id, resource.id);
        }
      }
    });

    scenario_ids.forEach((scenarioId) => {
      if (!nextRubrics.has(scenarioId)) {
        nextRubrics.set(scenarioId, null);
      }
    });

    // Only update if content actually changed
    setRubricIdByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextRubrics.entries()).sort());
      return prevKey === nextKey ? prev : nextRubrics;
    });
    setScenarioRubricIdsByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
  }, [currentResources, scenario_ids]);

  // Sync scenarioRubricIdsByScenario to parent via onChange (must be in useEffect, not during setState)
  // Use ref for onChange to avoid dependency that changes every render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = scenario_ids
      .map((scenarioId) => scenarioRubricIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onChangeRef.current(ids);
    }
  }, [scenarioRubricIdsByScenario, scenario_ids]);

  // Emit value callback for unified draft pattern
  const onScenarioRubricValuesRef = useRef(onScenarioRubricValues);
  onScenarioRubricValuesRef.current = onScenarioRubricValues;
  useEffect(() => {
    if (!onScenarioRubricValuesRef.current) return;
    const values: Array<{ scenario_id: string; rubric_id: string }> = [];
    rubricIdByScenario.forEach((rubricId, scenarioId) => {
      if (rubricId) {
        values.push({ scenario_id: scenarioId, rubric_id: rubricId });
      }
    });
    onScenarioRubricValuesRef.current(values);
  }, [rubricIdByScenario]);

  const handleSelect = useCallback(
    (scenarioId: string, value: string) => {
      const nextRubricId = value === NONE_OPTION ? null : value;

      setRubricIdByScenario((prev) => {
        const next = new Map(prev);
        next.set(scenarioId, nextRubricId);
        return next;
      });

      if (nextRubricId === null) {
        // Clear selection - useEffect will sync to parent via onChange
        setScenarioRubricIdsByScenario((prev) => {
          const next = new Map(prev);
          next.delete(scenarioId);
          return next;
        });
        return;
      }

      // Clear existing before setting new - useEffect will sync to parent via onChange
      setScenarioRubricIdsByScenario((prev) => {
        const next = new Map(prev);
        if (next.has(scenarioId)) {
          next.delete(scenarioId);
        }
        return next;
      });
    },
    [],
  );

  const rubricOptions = useMemo<ScenarioRubricOption[]>(() => {
    return allRubrics
      .filter((rubric) => rubric.id && rubric.name)
      .map((rubric) => ({
        id: rubric.id as string,
        name: rubric.name as string,
        description: rubric.description ?? "",
      }));
  }, [allRubrics]);

  const gridOptions = useMemo(() => {
    if (required) {
      return rubricOptions;
    }
    return [
      {
        id: NONE_OPTION,
        name: "No rubric",
        description: "Clear selection",
        isNone: true,
      },
      ...rubricOptions,
    ];
  }, [required, rubricOptions]);

  // Accept pending — keep pending rubric assignments in selection (no-op, already selected)
  const handleAccept = useCallback(() => {
    // Pending items are already in the resource array (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending scenario rubric assignments from selection
  const handleReject = useCallback(() => {
    pendingItems.forEach((r) => {
      if (r.scenario_id) {
        handleSelect(r.scenario_id, NONE_OPTION);
      }
    });
  }, [pendingItems, handleSelect]);

  if (!show || scenario_ids.length === 0) {
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
      <div className="space-y-4 pl-4">
        {scenario_ids.map((scenarioId) => {
          const isPendingScenario = pendingScenarioIds.has(scenarioId);
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);
          const selectedRubricId = rubricIdByScenario.get(scenarioId) ?? null;
          const selectedValue =
            selectedRubricId ?? (required ? "" : NONE_OPTION);

          // Find the pending rubric_id for this scenario (if any)
          const pendingRubricId = isPendingScenario
            ? pendingItems.find((r) => r.scenario_id === scenarioId)?.rubric_id ?? null
            : null;

          return (
            <div
              key={scenarioId}
              className={cn(
                "space-y-2",
                isPendingScenario &&
                  "ring-2 ring-success bg-success/5 rounded-lg p-2",
              )}
            >
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium" title={labelText}>
                  {labelText}
                </Label>
                {isPendingScenario && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
              </div>
              <SelectableGrid<ScenarioRubricOption>
                horizontal
                items={gridOptions}
                selectedId={selectedValue}
                onSelect={(optionId) => {
                  if (optionId === NONE_OPTION) {
                    handleSelect(scenarioId, NONE_OPTION);
                    return;
                  }
                  if (!required && optionId === selectedRubricId) {
                    handleSelect(scenarioId, NONE_OPTION);
                    return;
                  }
                  handleSelect(scenarioId, optionId);
                }}
                getId={(option) => option.id}
                renderItem={(option, isSelected) => {
                  const isPendingOption = isPendingScenario && option.id === pendingRubricId;

                  return (
                    <div
                      className={cn(
                        "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                        "hover:shadow-sm hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        option.isNone && "border-dashed text-muted-foreground",
                        isSelected && !isPendingOption && "ring-2 ring-primary bg-accent",
                        isPendingOption && "ring-2 ring-success bg-success/10",
                      )}
                    >
                      {/* Check icon - top right (non-pending selected) */}
                      {isSelected && !isPendingOption && (
                        <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}

                      {/* Pending badge - top right */}
                      {isPendingOption && (
                        <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                          Pending
                        </div>
                      )}

                      <div className="text-sm font-medium">{option.name}</div>
                      {option.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {option.description}
                        </div>
                      )}
                    </div>
                  );
                }}
                emptyMessage="No rubrics available."
                maxHeight="max-h-[220px]"
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
