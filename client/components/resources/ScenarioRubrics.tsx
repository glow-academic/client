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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;

export interface ScenarioRubricsProps {
  scenario_rubric_ids?: string[];
  scenario_rubric_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    rubric_id: string | null;
    generated?: boolean | null;
  }>;
  show_scenario_rubrics?: boolean;
  scenario_rubric_suggestions?: string[];
  scenario_rubrics?: Array<{
    id: string | null;
    scenario_id: string | null;
    rubric_id: string | null;
    generated?: boolean | null;
  }>;
  rubrics?: Array<{
    rubric_id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  scenario_ids?: string[];
  scenarios?: Array<{
    scenario_id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  scenario_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createScenarioRubricsAction?:
    | ( (
        input: CreateDraftScenarioRubricsIn
      ) => Promise<CreateDraftScenarioRubricsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

const NONE_OPTION = "__none__";

type ScenarioRubricOption = {
  id: string;
  name: string;
  description?: string;
  isNone?: boolean;
};

export function ScenarioRubrics({
  scenario_rubric_ids: _scenario_rubric_ids,
  scenario_rubric_resources,
  show_scenario_rubrics = false,
  scenario_rubric_suggestions: _scenario_rubric_suggestions,
  scenario_rubrics: _scenario_rubrics,
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
  group_id,
  agent_id,
  createScenarioRubricsAction,
  onGenerate,
  isGenerating = false,
}: ScenarioRubricsProps) {
  const show = show_scenario_rubrics ?? false;
  const currentResources = useMemo(
    () => scenario_rubric_resources ?? [],
    [scenario_rubric_resources]
  );
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);
  // Map from scenarios_resource.id (resource ID) to scenario_artifact.id (artifact ID)
  const resourceToArtifactMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenario_resources ?? []).forEach((scenario) => {
      if (scenario.id && scenario.scenario_id) {
        map.set(scenario.id, scenario.scenario_id);
      }
    });
    return map;
  }, [scenario_resources]);

  const scenarioLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full scenarios list as base (keyed by artifact ID)
    (scenarios ?? []).forEach((scenario) => {
      if (scenario.scenario_id) {
        const name = scenario.name?.trim() || null;
        const desc = scenario.description?.trim() || null;
        if (name || desc) {
          map.set(scenario.scenario_id, name || desc || "Untitled scenario");
        }
      }
    });
    // Override with scenario_resources (server-confirmed data takes priority)
    (scenario_resources ?? []).forEach((scenario) => {
      if (scenario.scenario_id) {
        const name = scenario.name?.trim() || "";
        const descriptionText = scenario.description?.trim() || "";
        map.set(
          scenario.scenario_id,
          name || descriptionText || "Untitled scenario"
        );
      }
    });
    return map;
  }, [scenarios, scenario_resources]);

  const [rubricIdByScenario, setRubricIdByScenario] = useState<
    Map<string, string | null>
  >(new Map());
  const [scenarioRubricIdsByScenario, setScenarioRubricIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const createdRubricKeysRef = useRef<Set<string>>(new Set());

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

    setRubricIdByScenario(nextRubrics);
    setScenarioRubricIdsByScenario(nextIds);
  }, [currentResources, scenario_ids]);

  const emitIds = useCallback(
    (next: Map<string, string>) => {
      const ids = scenario_ids
        .map((scenarioId) => next.get(scenarioId))
        .filter((value): value is string => Boolean(value));
      onChange(ids);
    },
    [onChange, scenario_ids]
  );

  const createScenarioRubric = useCallback(
    async (scenarioId: string, rubricId: string) => {
      if (!createScenarioRubricsAction || !agent_id || !group_id) {
        return;
      }
      const key = `${scenarioId}:${rubricId}`;
      if (createdRubricKeysRef.current.has(key)) {
        return;
      }
      createdRubricKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API
      const artifactScenarioId = resourceToArtifactMap.get(scenarioId) ?? scenarioId;

      try {
        const result = await createScenarioRubricsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            scenario_id: artifactScenarioId,
            rubric_id: rubricId,
            mcp: false,
          },
        });

        if (!result?.id) {
          return;
        }

        setScenarioRubricIdsByScenario((prev) => {
          const next = new Map(prev);
          next.set(scenarioId, result.id as string);
          emitIds(next);
          return next;
        });
      } catch {
        // Resource creation errors are handled by API; keep UI state intact.
      }
    },
    [
      createScenarioRubricsAction,
      agent_id,
      group_id,
      emitIds,
      resourceToArtifactMap,
    ]
  );

  const handleSelect = useCallback(
    (scenarioId: string, value: string) => {
      const nextRubricId = value === NONE_OPTION ? null : value;

      setRubricIdByScenario((prev) => {
        const next = new Map(prev);
        next.set(scenarioId, nextRubricId);
        return next;
      });

      if (nextRubricId === null) {
        setScenarioRubricIdsByScenario((prev) => {
          const next = new Map(prev);
          next.delete(scenarioId);
          emitIds(next);
          return next;
        });
        return;
      }

      setScenarioRubricIdsByScenario((prev) => {
        const next = new Map(prev);
        if (next.has(scenarioId)) {
          next.delete(scenarioId);
          emitIds(next);
        }
        return next;
      });

      void createScenarioRubric(scenarioId, nextRubricId);
    },
    [createScenarioRubric, emitIds]
  );

  const rubricOptions = useMemo<ScenarioRubricOption[]>(() => {
    return allRubrics
      .filter((rubric) => rubric.rubric_id && rubric.name)
      .map((rubric) => ({
        id: rubric.rubric_id as string,
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

  const hasGenerated = useMemo(() => {
    return currentResources.some((resource) => resource.generated);
  }, [currentResources]);

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
      <div className="space-y-2">
        {scenario_ids.map((scenarioId) => {
          const artifactId = resourceToArtifactMap.get(scenarioId) ?? scenarioId;
          const labelText =
            scenarioLabelMap.get(artifactId) ?? scenarioId.slice(0, 8);
          const selectedRubricId = rubricIdByScenario.get(scenarioId) ?? null;
          const selectedValue =
            selectedRubricId ?? (required ? "" : NONE_OPTION);
          return (
            <div
              key={scenarioId}
              className="space-y-3 rounded-lg border p-3"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <SelectableGrid<ScenarioRubricOption>
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
                renderItem={(option, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                      "hover:shadow-sm hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      option.isNone && "border-dashed text-muted-foreground",
                      isSelected && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="text-sm font-medium">{option.name}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {option.description}
                      </div>
                    )}
                  </div>
                )}
                emptyMessage="No rubrics available."
                maxHeight="max-h-[220px]"
                disabled={disabled}
              />
            </div>
          );
        })}
        {scenario_ids.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No scenarios selected. Select scenarios first to choose rubrics.
          </div>
        )}
      </div>
    </div>
  );
}
