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
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftSimulationScenarioFlagsOut = OutputOf<
  "/api/v4/resources/simulation_scenario_flags",
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

const NONE_OPTION = "__none__";

type ScenarioFlagOption = {
  id: string;
  name: string;
  description?: string;
  isNone?: boolean;
};

export function ScenarioFlags({
  scenario_flag_ids: _scenario_flag_ids,
  scenario_flag_resources,
  show_scenario_flags = false,
  scenario_flags,
  scenario_ids = [],
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
  }, [scenario_resources]);

  const [flagIdByScenario, setFlagIdByScenario] = useState<
    Map<string, string | null>
  >(new Map());
  const [scenarioFlagIdsByScenario, setScenarioFlagIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const createdFlagKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextFlags = new Map<string, string | null>();
    const nextIds = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.scenario_id) {
        nextFlags.set(resource.scenario_id, resource.flag_id ?? null);
        if (resource.id) {
          nextIds.set(resource.scenario_id, resource.id);
        }
      }
    });

    scenario_ids.forEach((scenarioId) => {
      if (!nextFlags.has(scenarioId)) {
        nextFlags.set(scenarioId, null);
      }
    });

    setFlagIdByScenario(nextFlags);
    setScenarioFlagIdsByScenario(nextIds);
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

      try {
        const result = await createScenarioFlagsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            scenario_id: scenarioId,
            flag_id: flagId,
            mcp: false,
          },
        });

        if (!result?.id) {
          return;
        }

        setScenarioFlagIdsByScenario((prev) => {
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
      createScenarioFlagsAction,
      agent_id,
      group_id,
      emitIds,
    ]
  );

  const handleSelect = useCallback(
    (scenarioId: string, value: string) => {
      const nextFlagId = value === NONE_OPTION ? null : value;

      setFlagIdByScenario((prev) => {
        const next = new Map(prev);
        next.set(scenarioId, nextFlagId);
        return next;
      });

      if (nextFlagId === null) {
        setScenarioFlagIdsByScenario((prev) => {
          const next = new Map(prev);
          next.delete(scenarioId);
          emitIds(next);
          return next;
        });
        return;
      }

      setScenarioFlagIdsByScenario((prev) => {
        const next = new Map(prev);
        if (next.has(scenarioId)) {
          next.delete(scenarioId);
          emitIds(next);
        }
        return next;
      });

      void createScenarioFlag(scenarioId, nextFlagId);
    },
    [createScenarioFlag, emitIds]
  );

  const flagOptions = useMemo<ScenarioFlagOption[]>(() => {
    return allFlags
      .filter((flag) => flag.flag_id && flag.name)
      .map((flag) => ({
        id: flag.flag_id as string,
        name: flag.name as string,
        description: flag.description ?? "",
      }));
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
          const selectedFlagId = flagIdByScenario.get(scenarioId) ?? null;
          return (
            <div
              key={scenarioId}
              className="space-y-2 rounded-lg border p-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {flagOptions.map((option) => {
                  const isSelected = selectedFlagId === option.id;
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
                          if (checked) {
                            handleSelect(scenarioId, option.id);
                            return;
                          }
                          if (!required) {
                            handleSelect(scenarioId, NONE_OPTION);
                          }
                        }}
                        disabled={disabled}
                        className="shrink-0"
                      />
                    </div>
                  );
                })}
                {flagOptions.length === 0 && (
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
