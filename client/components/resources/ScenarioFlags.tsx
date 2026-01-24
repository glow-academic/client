/**
 * ScenarioFlags.tsx
 * Resource component for per-scenario flag selection
 * Uses base flags list and creates scenario_flags_resource entries
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftSimulationScenarioFlagsIn = InputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;
type CreateDraftSimulationScenarioFlagsOut = OutputOf<
  "/api/v4/resources/scenario_flags",
  "post"
>;

export interface ScenarioFlagsProps {
  scenario_flag_ids?: string[];
  scenario_flag_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    flag_id: string | null;
    generated?: boolean | null;
  }>;
  show_scenario_flags?: boolean;
  scenario_flags?: Array<{
    id: string | null;
    scenario_id: string | null;
    flag_id: string | null;
    name: string | null;
    description?: string | null;
    icon_id?: string | null;
    generated?: boolean | null;
  }>;
  scenario_ids?: string[];
  scenarios?: Array<{
    id: string | null;
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
  createScenarioFlagsAction?:
    | ( (
        input: CreateDraftSimulationScenarioFlagsIn
      ) => Promise<CreateDraftSimulationScenarioFlagsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

type ScenarioFlagOption = {
  id: string;
  name: string;
  description?: string;
};

export function ScenarioFlags({
  scenario_flag_ids: _scenario_flag_ids,
  scenario_flag_resources,
  show_scenario_flags = false,
  scenario_flags,
  scenario_ids = [],
  scenarios,
  scenario_resources,
  disabled = false,
  onChange,
  label = "Scenario Flags",
  id = "scenario_flags",
  required = false,
  description,
  group_id,
  agent_id,
  createScenarioFlagsAction,
  onGenerate,
  isGenerating = false,
}: ScenarioFlagsProps) {
  const show = show_scenario_flags ?? false;
  const allFlags = useMemo(() => scenario_flags ?? [], [scenario_flags]);
  const currentResources = useMemo(
    () => scenario_flag_resources ?? [],
    [scenario_flag_resources]
  );
  const scenarioLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full scenarios list as base (keyed by resource ID to match scenario_ids)
    (scenarios ?? []).forEach((scenario) => {
      if (scenario.id) {
        const name = scenario.name?.trim() || null;
        const desc = scenario.description?.trim() || null;
        if (name || desc) {
          map.set(scenario.id, name || desc || "Untitled scenario");
        }
      }
    });
    // Override with scenario_resources (server-confirmed data takes priority)
    (scenario_resources ?? []).forEach((scenario) => {
      if (scenario.id) {
        const name = scenario.name?.trim() || "";
        const descriptionText = scenario.description?.trim() || "";
        map.set(
          scenario.id,
          name || descriptionText || "Untitled scenario"
        );
      }
    });
    return map;
  }, [scenarios, scenario_resources]);
  // Map resource ID → artifact ID for API calls (API expects scenario_artifact.id)
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((s) => {
      if (s.id && s.scenario_id) map.set(s.id, s.scenario_id);
    });
    (scenario_resources ?? []).forEach((s) => {
      if (s.id && s.scenario_id) map.set(s.id, s.scenario_id);
    });
    return map;
  }, [scenarios, scenario_resources]);

  // Multi-select: maps scenarioId → Set of selected flagIds
  const [selectedFlagsByScenario, setSelectedFlagsByScenario] = useState<
    Map<string, Set<string>>
  >(new Map());
  // Maps "scenarioId:flagId" → scenario_flags_resource ID (for emitting)
  const [scenarioFlagResourceIds, setScenarioFlagResourceIds] = useState<
    Map<string, string>
  >(new Map());
  const createdFlagKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextSelected = new Map<string, Set<string>>();
    const nextResourceIds = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.scenario_id && resource.flag_id) {
        if (!nextSelected.has(resource.scenario_id)) {
          nextSelected.set(resource.scenario_id, new Set());
        }
        nextSelected.get(resource.scenario_id)!.add(resource.flag_id);
        if (resource.id) {
          nextResourceIds.set(
            `${resource.scenario_id}:${resource.flag_id}`,
            resource.id
          );
        }
      }
    });

    scenario_ids.forEach((scenarioId) => {
      if (!nextSelected.has(scenarioId)) {
        nextSelected.set(scenarioId, new Set());
      }
    });

    setSelectedFlagsByScenario(nextSelected);
    setScenarioFlagResourceIds(nextResourceIds);
  }, [currentResources, scenario_ids]);

  const emitAllIds = useCallback(
    (resourceIds: Map<string, string>) => {
      const ids = Array.from(resourceIds.values());
      onChange(ids);
    },
    [onChange]
  );

  const createScenarioFlag = useCallback(
    async (scenarioId: string, flagId: string) => {
      if (!createScenarioFlagsAction || !agent_id || !group_id) {
        return;
      }
      const key = `${scenarioId}:${flagId}`;
      if (createdFlagKeysRef.current.has(key)) {
        return;
      }
      createdFlagKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API
      const artifactScenarioId = artifactIdMap.get(scenarioId) ?? scenarioId;

      try {
        const result = await createScenarioFlagsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            scenario_id: artifactScenarioId,
            flag_id: flagId,
            mcp: false,
          },
        });

        if (!result?.scenario_flags_id) {
          return;
        }

        const resultId = result.scenario_flags_id as string;
        setScenarioFlagResourceIds((prev) => {
          const next = new Map(prev);
          next.set(key, resultId);
          // Emit after building the updated map
          emitAllIds(next);
          return next;
        });
      } catch {
        // Resource creation errors are handled by API; keep UI state intact.
      }
    },
    [
      createScenarioFlagsAction,
      agent_id,
      group_id,
      emitAllIds,
      artifactIdMap,
    ]
  );

  const handleToggle = useCallback(
    (scenarioId: string, flagId: string, checked: boolean) => {
      const key = `${scenarioId}:${flagId}`;

      setSelectedFlagsByScenario((prev) => {
        const next = new Map(prev);
        const flags = new Set(prev.get(scenarioId) ?? []);
        if (checked) {
          flags.add(flagId);
        } else {
          flags.delete(flagId);
        }
        next.set(scenarioId, flags);
        return next;
      });

      if (checked) {
        void createScenarioFlag(scenarioId, flagId);
      } else {
        setScenarioFlagResourceIds((prev) => {
          const next = new Map(prev);
          next.delete(key);
          emitAllIds(next);
          return next;
        });
      }
    },
    [createScenarioFlag, emitAllIds]
  );

  // Group flags by scenario_id (resource ID) from the SQL query
  // The SQL now returns flags per-scenario via resource_flags_relation
  const flagOptionsByScenario = useMemo(() => {
    const map = new Map<string, ScenarioFlagOption[]>();

    allFlags
      .filter((flag) => flag.flag_id && flag.name && flag.scenario_id)
      .forEach((flag) => {
        const scenarioId = flag.scenario_id as string;
        if (!map.has(scenarioId)) {
          map.set(scenarioId, []);
        }
        map.get(scenarioId)!.push({
          id: flag.flag_id as string,
          name: flag.name as string,
          description: flag.description ?? "",
        });
      });

    return map;
  }, [allFlags]);

  const hasGenerated = useMemo(() => {
    return currentResources.some((flag) => flag.generated);
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
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);
          const selectedFlags =
            selectedFlagsByScenario.get(scenarioId) ?? new Set<string>();
          const scenarioOptions = flagOptionsByScenario.get(scenarioId) ?? [];
          return (
            <div
              key={scenarioId}
              className="space-y-2 rounded-lg border p-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {scenarioOptions.map((option) => {
                  const isSelected = selectedFlags.has(option.id);
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                        isSelected && "border-primary/50 bg-accent/40"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium">{option.name}</div>
                        {option.description && (
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            {option.description}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          handleToggle(scenarioId, option.id, checked);
                        }}
                        disabled={disabled}
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
                {scenarioOptions.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">
                    No scenario flags available.
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {scenario_ids.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No scenarios selected. Select scenarios first to choose flags.
          </div>
        )}
      </div>
    </div>
  );
}
