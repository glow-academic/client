/**
 * ScenarioTimeLimits.tsx
 * Resource component for managing scenario time limits within simulations
 * Allows setting time limits per selected scenario
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useSocket } from "@/contexts/socket-context";
import { Check, Clock, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioTimeLimitsIn = InputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;
type CreateDraftScenarioTimeLimitsOut = OutputOf<
  "/api/v4/resources/scenario_time_limits",
  "post"
>;

// Derive resource item type from the GET endpoint response
type ScenarioTimeLimitGetResponse = OutputOf<"/api/v4/resources/scenario_time_limits/get", "post">;
export type ScenarioTimeLimitResourceItem = NonNullable<ScenarioTimeLimitGetResponse["items"]>[number];

export interface ScenarioTimeLimitsProps {
  scenario_time_limit_ids?: string[];
  scenario_time_limit_resources?: ScenarioTimeLimitResourceItem[];
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
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createScenarioTimeLimitsAction?:
    | ((
        input: CreateDraftScenarioTimeLimitsIn
      ) => Promise<CreateDraftScenarioTimeLimitsOut>)
    | undefined;
  onTimeLimitIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ scenario_time_limit_ids: string[] } | void>) => void;
  // AI diff view props
  aiScenarioTimeLimitResources?: Pick<ScenarioTimeLimitResourceItem, "id" | "scenario_id" | "time_limit_seconds">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
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
  create_tool_id,
  createScenarioTimeLimitsAction,
  onTimeLimitIdsChange,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiScenarioTimeLimitResources,
  onAccept,
  onReject,
  onGenerationComplete,
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
  // From get_simulation SQL: s.id = scenarios_resource.id, s.scenario_id = scenario_artifact.id (via junction)
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((s) => {
      // s.id = scenarios_resource.id (denormalized), s.scenario_id = scenario_artifact.id (canonical)
      if (s.id && s.scenario_id) {
        map.set(s.id, s.scenario_id);
      } else if (s.scenario_id) {
        map.set(s.scenario_id, s.scenario_id);
      }
    });
    (scenario_resources ?? []).forEach((s) => {
      if (s.id && s.scenario_id) {
        map.set(s.id, s.scenario_id);
      } else if (s.scenario_id) {
        map.set(s.scenario_id, s.scenario_id);
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

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ scenario_time_limit_ids: string[] } | void>) | null>(null);

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

    // Only update if content actually changed
    setTimeLimitByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextLimits.entries()).sort());
      return prevKey === nextKey ? prev : nextLimits;
    });
    setTimeLimitIdsByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
  }, [scenario_ids, timeLimitResources]);

  // Sync timeLimitIdsByScenario to parent via onTimeLimitIdsChange (must be in useEffect, not during setState)
  // Use ref for onTimeLimitIdsChange to avoid dependency that changes every render
  const onTimeLimitIdsChangeRef = useRef(onTimeLimitIdsChange);
  onTimeLimitIdsChangeRef.current = onTimeLimitIdsChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!onTimeLimitIdsChangeRef.current) return;
    const ids = scenario_ids
      .map((scenarioId) => timeLimitIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onTimeLimitIdsChangeRef.current(ids);
    }
  }, [timeLimitIdsByScenario, scenario_ids]);

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{ scenario_time_limit_ids: string[] } | void> => {
    const ids = scenario_ids
      .map((scenarioId) => timeLimitIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    return { scenario_time_limit_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createTimeLimit = useCallback(
    async (scenarioId: string, value: number) => {
      if (!isAutosaveEnabled || !createScenarioTimeLimitsAction || !group_id) {
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
            group_id: group_id,
            scenario_id: artifactScenarioId,
            time_limit_seconds: value,
            mcp: false,
          },
        });

        if (!result?.id) {
          return;
        }

        // Update state - useEffect will sync to parent via onTimeLimitIdsChange
        setTimeLimitIdsByScenario((prev) => {
          const next = new Map(prev);
          next.set(scenarioId, result.id as string);
          return next;
        });
      } catch {
        // Resource creation errors are handled by API; keep UI state intact.
      }
    },
    [
      isAutosaveEnabled,
      createScenarioTimeLimitsAction,
      create_tool_id,
      group_id,
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

  // AI suggestion state
  const showDiff = !!aiScenarioTimeLimitResources?.length;

  // Set of AI-suggested scenario IDs for styling
  const aiSuggestedScenarioIds = useMemo(
    () =>
      new Set(
        aiScenarioTimeLimitResources
          ?.map((r) => r.scenario_id)
          .filter(Boolean) as string[]
      ),
    [aiScenarioTimeLimitResources]
  );

  // Accept AI suggestion - apply AI-suggested time limits
  const handleAccept = useCallback(() => {
    if (!aiScenarioTimeLimitResources?.length) return;
    aiScenarioTimeLimitResources.forEach((r) => {
      if (r.scenario_id && r.time_limit_seconds != null) {
        handleChange(r.scenario_id, String(r.time_limit_seconds));
      }
    });
    onAccept?.();
  }, [aiScenarioTimeLimitResources, handleChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && showAiGenerate && create_tool_id && (
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
      {/* AI-suggested time limits preview */}
      {showDiff && aiScenarioTimeLimitResources && aiScenarioTimeLimitResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Time Limits</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {aiScenarioTimeLimitResources.map((item, idx) => {
              const scenarioLabel = scenarioLabelMap.get(item.scenario_id || "") ?? "Unknown scenario";
              const minutes = item.time_limit_seconds != null ? Math.floor(item.time_limit_seconds / 60) : null;
              const seconds = item.time_limit_seconds != null ? item.time_limit_seconds % 60 : null;
              const timeDisplay = item.time_limit_seconds != null
                ? `${minutes}m ${seconds}s`
                : "Unlimited";
              return (
                <div
                  key={item.id || item.scenario_id || idx}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 border-success bg-success/10",
                    "text-sm"
                  )}
                >
                  <Clock className="h-4 w-4 text-success" />
                  <span className="font-medium">{scenarioLabel}:</span>
                  <span>{timeDisplay}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
        {scenario_ids.map((scenarioId) => {
          const isAiSuggested = aiSuggestedScenarioIds.has(scenarioId);
          const currentValue = timeLimitByScenario.get(scenarioId);
          const isUnlimited = currentValue === null;
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

          const handleUnlimitedToggle = (checked: boolean) => {
            if (checked) {
              // Set to unlimited (null/empty)
              handleChange(scenarioId, "");
            } else {
              // Set a default value when switching from unlimited
              handleChange(scenarioId, "60"); // Default to 1 minute
            }
          };

          return (
            <div
              key={scenarioId}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:bg-accent/50",
                isAiSuggested && "ring-2 ring-success bg-success/5"
              )}
            >
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate" title={labelText}>
                  {labelText}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isUnlimited}
                      onCheckedChange={handleUnlimitedToggle}
                      disabled={disabled}
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                  {!isUnlimited && (
                    <>
                      <div className="w-px h-4 bg-border mx-1" />
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
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
