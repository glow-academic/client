/**
 * ScenarioTimeLimits.tsx
 * Resource component for managing scenario time limits within simulations
 * Allows setting time limits per selected scenario
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;

export interface ScenarioTimeLimitsProps {
  scenario_time_limit_ids?: string[];
  scenario_time_limit_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    time_limit_seconds: number | null;
    generated?: boolean | null;
  }>;
  show_scenario_time_limits?: boolean;
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
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createScenarioTimeLimitsAction?:
    | ((
        input: CreateDraftScenarioTimeLimitsIn
      ) => Promise<CreateDraftScenarioTimeLimitsOut>)
    | undefined;
  onTimeLimitIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ScenarioTimeLimits({
  scenario_time_limit_ids,
  scenario_time_limit_resources,
  show_scenario_time_limits = false,
  scenario_ids = [],
  scenarios,
  scenario_resources,
  disabled = false,
  label = "Scenario Time Limits",
  id = "scenario_time_limits",
  required = false,
  description,
  group_id,
  agent_id,
  createScenarioTimeLimitsAction,
  onTimeLimitIdsChange,
  onGenerate,
  isGenerating = false,
}: ScenarioTimeLimitsProps) {
  const show = show_scenario_time_limits ?? false;
  const timeLimitResources = useMemo(
    () => scenario_time_limit_resources ?? [],
    [scenario_time_limit_resources]
  );
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

  const [timeLimitByScenario, setTimeLimitByScenario] = useState<
    Map<string, number | null>
  >(new Map());
  const [timeLimitIdsByScenario, setTimeLimitIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const createdTimeLimitKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextLimits = new Map<string, number | null>();
    const nextIds = new Map<string, string>();

    timeLimitResources.forEach((resource) => {
      if (resource.scenario_id) {
        nextLimits.set(resource.scenario_id, resource.time_limit_seconds ?? null);
        if (resource.id) {
          nextIds.set(resource.scenario_id, resource.id);
        }
      }
    });

    scenario_ids.forEach((scenarioId) => {
      if (!nextLimits.has(scenarioId)) {
        nextLimits.set(scenarioId, null);
      }
    });

    setTimeLimitByScenario(nextLimits);
    setTimeLimitIdsByScenario(nextIds);
  }, [scenario_ids, timeLimitResources]);

  const emitIds = useCallback(
    (next: Map<string, string>) => {
      if (!onTimeLimitIdsChange) return;
      const ids = scenario_ids
        .map((scenarioId) => next.get(scenarioId))
        .filter((value): value is string => Boolean(value));
      onTimeLimitIdsChange(ids);
    },
    [onTimeLimitIdsChange, scenario_ids]
  );

  const createTimeLimit = useCallback(
    async (scenarioId: string, value: number) => {
      if (!createScenarioTimeLimitsAction || !agent_id || !group_id) {
        return;
      }
      const key = `${scenarioId}:${value}`;
      if (createdTimeLimitKeysRef.current.has(key)) {
        return;
      }
      createdTimeLimitKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API
      const artifactScenarioId = resourceToArtifactMap.get(scenarioId) ?? scenarioId;

      try {
        const result = await createScenarioTimeLimitsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            scenario_id: artifactScenarioId,
            time_limit_seconds: value,
            mcp: false,
          },
        });

        if (!result?.id) {
          return;
        }

        setTimeLimitIdsByScenario((prev) => {
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
      createScenarioTimeLimitsAction,
      agent_id,
      group_id,
      emitIds,
      resourceToArtifactMap,
    ]
  );

  const handleChange = useCallback(
    (scenarioId: string, value: string) => {
      const parsed = value.trim() === "" ? null : Number(value);
      const nextValue =
        parsed !== null && Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : null;

      setTimeLimitByScenario((prev) => {
        const next = new Map(prev);
        next.set(scenarioId, nextValue);
        return next;
      });

      if (nextValue !== null) {
        void createTimeLimit(scenarioId, nextValue);
      }
    },
    [createTimeLimit]
  );

  const hasGenerated = useMemo(() => {
    return timeLimitResources.some((resource) => resource.generated);
  }, [timeLimitResources]);

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
          const currentValue = timeLimitByScenario.get(scenarioId);
          const artifactId = resourceToArtifactMap.get(scenarioId) ?? scenarioId;
          const labelText =
            scenarioLabelMap.get(artifactId) ?? scenarioId.slice(0, 8);
          return (
            <div
              key={scenarioId}
              className="flex items-center gap-2 p-2 border rounded-md"
            >
              <Label className="text-sm w-40 truncate" title={labelText}>
                {labelText}
              </Label>
              <Input
                type="number"
                min={1}
                value={currentValue ?? ""}
                onChange={(event) =>
                  handleChange(scenarioId, event.target.value)
                }
                placeholder="Seconds"
                disabled={disabled}
                className="w-32"
              />
            </div>
          );
        })}
        {scenario_ids.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No scenarios selected. Select scenarios first to set time limits.
          </div>
        )}
      </div>
    </div>
  );
}
