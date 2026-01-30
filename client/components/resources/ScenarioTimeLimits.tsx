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
import { Clock, Loader2, Sparkles } from "lucide-react";
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
        map.set(
          id,
          name || descriptionText || "Untitled scenario"
        );
      }
    });
    return map;
  }, [scenarios, scenario_resources]);
  // Map resource ID → artifact ID for API calls (API expects scenario_artifact.id)
  // Handle both naming conventions: API returns scenario_id/title, but we also support id/name
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((s) => {
      const id = s.scenario_id || s.id;
      // For scenarios_resource data, scenario_id IS the ID (not a foreign key)
      if (id) map.set(id, id);
    });
    (scenario_resources ?? []).forEach((s) => {
      const id = s.scenario_id || s.id;
      if (id) map.set(id, id);
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
      const artifactScenarioId = artifactIdMap.get(scenarioId) ?? scenarioId;

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
      artifactIdMap,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
        {scenario_ids.map((scenarioId) => {
          const currentValue = timeLimitByScenario.get(scenarioId);
          const minutes = currentValue != null ? Math.floor(currentValue / 60) : null;
          const seconds = currentValue != null ? currentValue % 60 : null;
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);

          const handleMinutesChange = (value: string) => {
            const newMinutes = value.trim() === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
            const currentSeconds = seconds ?? 0;
            const totalSeconds = newMinutes * 60 + currentSeconds;
            handleChange(scenarioId, totalSeconds > 0 ? String(totalSeconds) : "");
          };

          const handleSecondsChange = (value: string) => {
            const newSeconds = value.trim() === "" ? 0 : Math.min(59, Math.max(0, parseInt(value, 10) || 0));
            const currentMinutes = minutes ?? 0;
            const totalSeconds = currentMinutes * 60 + newSeconds;
            handleChange(scenarioId, totalSeconds > 0 ? String(totalSeconds) : "");
          };

          return (
            <div
              key={scenarioId}
              className="relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:bg-accent/50"
            >
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate" title={labelText}>
                  {labelText}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min={0}
                    value={minutes ?? ""}
                    onChange={(event) => handleMinutesChange(event.target.value)}
                    placeholder="0"
                    disabled={disabled}
                    className="w-16 h-8"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={seconds ?? ""}
                    onChange={(event) => handleSecondsChange(event.target.value)}
                    placeholder="0"
                    disabled={disabled}
                    className="w-16 h-8"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
