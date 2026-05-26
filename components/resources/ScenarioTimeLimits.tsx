/**
 * ScenarioTimeLimits.tsx
 * Resource component for managing scenario time limits within simulations
 * Allows setting time limits per selected scenario
 * Uses pending field pattern for AI-generated suggestions (no socket/useResourceAi)
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
import { cn } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ScenarioTimeLimitResourceItem {
  id?: string | null;
  scenario_id?: string | null;
  time_limit_seconds?: number | null;
  negative?: boolean | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

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
  onTimeLimitIdsChange?: (ids: string[]) => void;
  /** Value callback for unified draft — reports all scenario+time_limit pairs */
  onScenarioTimeLimitValues?: (timeLimits: Array<{ scenario_id: string; time_limit_seconds: number; negative: boolean }>) => void;
  /**
   * Whether the Unlimited toggle should be available. Gated by the
   * simulation's practice flag — non-practice (training / assessment)
   * simulations must specify a concrete time limit.
   */
  allowUnlimited?: boolean;
  /** Per-field pending lifecycle (multi-select). See ParameterFields.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

export function ScenarioTimeLimits({
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
  onTimeLimitIdsChange,
  onScenarioTimeLimitValues,
  allowUnlimited = false,
  onAcceptPending,
  onRejectPending,
}: ScenarioTimeLimitsProps) {
  const show = show_scenario_time_limits ?? false;
  const timeLimitResources = useMemo(
    () => scenario_time_limit_resources ?? [],
    [scenario_time_limit_resources],
  );

  // Detect pending items from resource array (server-driven soft state)
  const pendingResources = useMemo(
    () => timeLimitResources.filter((r) => r.pending),
    [timeLimitResources],
  );
  const showDiff = pendingResources.length > 0;
  const pendingScenarioIds = useMemo(
    () => new Set(pendingResources.map((r) => r.scenario_id).filter(Boolean) as string[]),
    [pendingResources],
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

  const [timeLimitByScenario, setTimeLimitByScenario] = useState<
    Map<string, number | null>
  >(new Map());
  const [negativeByScenario, setNegativeByScenario] = useState<
    Map<string, boolean>
  >(new Map());
  const [timeLimitIdsByScenario, setTimeLimitIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  // Dirty flag: flipped inside handleChange / handleNegativeToggle so the
  // hydrate effect doesn't overwrite an in-flight edit (e.g. the user
  // flipping Unlimited off) with stale server data.
  const isDirtyRef = useRef(false);
  useEffect(() => {
    const nextLimits = new Map<string, number | null>();
    const nextIds = new Map<string, string>();
    const nextNegative = new Map<string, boolean>();

    timeLimitResources.forEach((resource) => {
      if (resource.scenario_id) {
        nextLimits.set(
          resource.scenario_id,
          resource.time_limit_seconds ?? null,
        );
        nextNegative.set(resource.scenario_id, resource.negative ?? false);
        if (resource.id) {
          nextIds.set(resource.scenario_id, resource.id);
        }
      }
    });

    scenario_ids.forEach((scenarioId) => {
      if (!nextLimits.has(scenarioId)) {
        nextLimits.set(scenarioId, null);
      }
      if (!nextNegative.has(scenarioId)) {
        nextNegative.set(scenarioId, false);
      }
    });

    // Resource-id mapping always hydrates so new server-assigned ids flow
    // through onTimeLimitIdsChange, regardless of dirty state.
    setTimeLimitIdsByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });

    // Freeze visible-value hydration after the user interacts so a stale
    // server refetch doesn't overwrite the value they just typed or the
    // Unlimited toggle they just flipped.
    if (isDirtyRef.current) return;

    setTimeLimitByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextLimits.entries()).sort());
      return prevKey === nextKey ? prev : nextLimits;
    });
    setNegativeByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextNegative.entries()).sort());
      return prevKey === nextKey ? prev : nextNegative;
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

  // Emit value callback for unified draft pattern.
  //
  // Content-dedup (matches the id-emit effect above). Without it, every
  // time the sync effect replaces the internal map ref — even with the
  // same content — this fired a fresh array up to the parent, which
  // kept re-setting `formState.scenario_time_limits` and triggering a
  // new autosave → a new append-only draft id. That showed up as the
  // draftId URL param churning while the user sat on the time-limits
  // section. Guard emits by a canonical JSON key instead.
  const onScenarioTimeLimitValuesRef = useRef(onScenarioTimeLimitValues);
  onScenarioTimeLimitValuesRef.current = onScenarioTimeLimitValues;
  const prevValuesKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onScenarioTimeLimitValuesRef.current) return;
    const values: Array<{ scenario_id: string; time_limit_seconds: number; negative: boolean }> = [];
    timeLimitByScenario.forEach((seconds, scenarioId) => {
      if (seconds !== null) {
        values.push({
          scenario_id: scenarioId,
          time_limit_seconds: seconds,
          negative: negativeByScenario.get(scenarioId) ?? false,
        });
      }
    });
    values.sort((a, b) => a.scenario_id.localeCompare(b.scenario_id));
    const key = JSON.stringify(values);
    if (key === prevValuesKeyRef.current) return;
    prevValuesKeyRef.current = key;
    onScenarioTimeLimitValuesRef.current(values);
  }, [timeLimitByScenario, negativeByScenario]);

  const handleChange = useCallback(
    (scenarioId: string, value: string) => {
      isDirtyRef.current = true;
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
    },
    [],
  );

  // Junction-row ids (scenario_time_limits_resource.id) flagged pending=true.
  const pendingResourceIds = useMemo(
    () =>
      pendingResources
        .map((r) => r.id)
        .filter((id): id is string => !!id),
    [pendingResources],
  );

  // Accept pending — pending items already in form state.
  // Parent hook (if provided) strips them from ``pending_ids``.
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingResourceIds.length > 0) {
      onAcceptPending(pendingResourceIds);
    }
  }, [onAcceptPending, pendingResourceIds]);

  // Reject pending — clear pending time limit selections
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingResourceIds.length > 0) {
      onRejectPending(pendingResourceIds);
      return;
    }
    for (const r of pendingResources) {
      if (r.scenario_id) {
        handleChange(r.scenario_id, "");
      }
    }
  }, [pendingResources, handleChange, onRejectPending, pendingResourceIds]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
        {scenario_ids.map((scenarioId) => {
          const isPending = pendingScenarioIds.has(scenarioId);
          const currentValue = timeLimitByScenario.get(scenarioId);
          const isUnlimited = currentValue === null;
          const minutes =
            currentValue != null ? Math.floor(currentValue / 60) : null;
          const seconds = currentValue != null ? currentValue % 60 : null;
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);

          const handleMinutesChange = (value: string) => {
            const newMinutes =
              value.trim() === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
            const currentSeconds = seconds ?? 0;
            const totalSeconds = newMinutes * 60 + currentSeconds;
            handleChange(
              scenarioId,
              totalSeconds > 0 ? String(totalSeconds) : "",
            );
          };

          const handleSecondsChange = (value: string) => {
            const newSeconds =
              value.trim() === ""
                ? 0
                : Math.min(59, Math.max(0, parseInt(value, 10) || 0));
            const currentMinutes = minutes ?? 0;
            const totalSeconds = currentMinutes * 60 + newSeconds;
            handleChange(
              scenarioId,
              totalSeconds > 0 ? String(totalSeconds) : "",
            );
          };

          const isNegative = negativeByScenario.get(scenarioId) ?? false;

          const handleUnlimitedToggle = (checked: boolean) => {
            if (checked) {
              // Set to unlimited (null/empty)
              handleChange(scenarioId, "");
            } else {
              // Set a default value when switching from unlimited
              handleChange(scenarioId, "60"); // Default to 1 minute
            }
          };

          const handleNegativeToggle = (checked: boolean) => {
            isDirtyRef.current = true;
            setNegativeByScenario((prev) => {
              const next = new Map(prev);
              next.set(scenarioId, checked);
              return next;
            });
          };

          return (
            <div
              key={scenarioId}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:bg-accent/50",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3
                  className="font-medium text-sm leading-tight truncate"
                  title={labelText}
                >
                  {labelText}
                  {isPending && (
                    <span className="ml-2 text-xs text-success font-medium">
                      Pending
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  {/* Unlimited toggle is only available for practice
                      simulations — training/assessment must commit to a
                      concrete time budget, so the switch is hidden there
                      and the numeric fields render unconditionally. */}
                  {allowUnlimited && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isUnlimited}
                        onCheckedChange={handleUnlimitedToggle}
                        disabled={disabled}
                      />
                      <span className="text-xs text-muted-foreground">
                        Unlimited
                      </span>
                    </div>
                  )}
                  {(!allowUnlimited || !isUnlimited) && (
                    <>
                      {allowUnlimited && (
                        <div className="w-px h-4 bg-border mx-1" />
                      )}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isNegative}
                          onCheckedChange={handleNegativeToggle}
                          disabled={disabled}
                        />
                        <span className="text-xs text-muted-foreground">
                          Negative
                        </span>
                      </div>
                      <div className="w-px h-4 bg-border mx-1" />
                      <Input
                        type="number"
                        min={0}
                        value={minutes ?? ""}
                        onChange={(event) =>
                          handleMinutesChange(event.target.value)
                        }
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
                        onChange={(event) =>
                          handleSecondsChange(event.target.value)
                        }
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
