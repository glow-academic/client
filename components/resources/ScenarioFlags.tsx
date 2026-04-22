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
import { SvgIcon } from "@/components/common/SvgIcon";
import { cn } from "@/lib/utils";
import { Check, Power, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ScenarioFlagsResourceItem {
  id?: string | null;
  scenario_id?: string | null;
  flag_id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface ScenarioFlagsProps {
  scenario_flag_ids?: string[];
  scenario_flag_resources?: ScenarioFlagsResourceItem[];
  show_scenario_flags?: boolean;
  scenario_flags?: ScenarioFlagsResourceItem[];
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
    // Show flags from backend (controls which flags to render)
    show_problem_statement?: boolean | null;
    show_objectives?: boolean | null;
    show_video?: boolean | null;
    show_text?: boolean | null;
    show_audio?: boolean | null;
    show_copy_paste?: boolean | null;
    show_images?: boolean | null;
    show_questions?: boolean | null;
    show_templates?: boolean | null;
    show_hints?: boolean | null; // Computed on frontend based on practice_simulation
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  /** Value callback for unified draft — reports all selected scenario+flag pairs */
  onScenarioFlagValues?: (flags: Array<{ scenario_id: string; flag_id: string }>) => void;
}

type ScenarioFlagOption = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
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
  onScenarioFlagValues,
}: ScenarioFlagsProps) {
  const show = show_scenario_flags ?? false;
  const allFlags = useMemo(() => scenario_flags ?? [], [scenario_flags]);
  const currentResources = useMemo(
    () => scenario_flag_resources ?? [],
    [scenario_flag_resources]
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

  // Multi-select: maps scenarioId → Set of selected flagIds
  const [selectedFlagsByScenario, setSelectedFlagsByScenario] = useState<
    Map<string, Set<string>>
  >(new Map());
  // Maps "scenarioId:flagId" → scenario_flags_resource ID (for emitting)
  const [scenarioFlagResourceIds, setScenarioFlagResourceIds] = useState<
    Map<string, string>
  >(new Map());
  // Detect pending items from current resources (items with pending: true)
  const pendingResources = useMemo(
    () => currentResources.filter((r) => r.pending),
    [currentResources]
  );
  const showDiff = pendingResources.length > 0;
  const pendingByScenario = useMemo(() => {
    const map = new Map<string, Set<string>>();
    pendingResources.forEach((r) => {
      if (r.scenario_id && r.flag_id) {
        if (!map.has(r.scenario_id)) {
          map.set(r.scenario_id, new Set());
        }
        map.get(r.scenario_id)!.add(r.flag_id);
      }
    });
    return map;
  }, [pendingResources]);

  // Hydrate internal selection from server resources. Once the user has
  // interacted (isDirtyRef flipped inside handleToggle), stop syncing so
  // we don't clobber their in-flight click with the still-empty server
  // state — which would visually flip the Switch off the moment they
  // turned it on.
  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (isDirtyRef.current) {
      // Still refresh resource-id mapping so new server-assigned ids flow
      // through onChange emits, without touching the visible selection.
      const nextResourceIds = new Map<string, string>();
      currentResources.forEach((resource) => {
        if (resource.scenario_id && resource.flag_id && resource.id) {
          nextResourceIds.set(
            `${resource.scenario_id}:${resource.flag_id}`,
            resource.id,
          );
        }
      });
      setScenarioFlagResourceIds((prev) => {
        const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
        const nextKey = JSON.stringify(Array.from(nextResourceIds.entries()).sort());
        return prevKey === nextKey ? prev : nextResourceIds;
      });
      return;
    }

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

    // Only update if content actually changed (compare by serializing)
    setSelectedFlagsByScenario((prev) => {
      const prevKey = JSON.stringify(
        Array.from(prev.entries()).map(([k, v]) => [k, Array.from(v).sort()])
      );
      const nextKey = JSON.stringify(
        Array.from(nextSelected.entries()).map(([k, v]) => [k, Array.from(v).sort()])
      );
      return prevKey === nextKey ? prev : nextSelected;
    });
    setScenarioFlagResourceIds((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextResourceIds.entries()).sort());
      return prevKey === nextKey ? prev : nextResourceIds;
    });
  }, [currentResources, scenario_ids]);

  // Sync scenarioFlagResourceIds to parent via onChange (must be in useEffect, not during setState)
  // Use ref for onChange to avoid dependency that changes every render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = Array.from(scenarioFlagResourceIds.values());
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onChangeRef.current(ids);
    }
  }, [scenarioFlagResourceIds]);

  // Emit value callback for unified draft pattern. Gate on the same
  // isDirtyRef as the hydrate effect: synthetic state built from server
  // resources shouldn't round-trip back up as if the user typed it.
  const onScenarioFlagValuesRef = useRef(onScenarioFlagValues);
  onScenarioFlagValuesRef.current = onScenarioFlagValues;
  useEffect(() => {
    if (!onScenarioFlagValuesRef.current) return;
    if (!isDirtyRef.current) return;
    const values: Array<{ scenario_id: string; flag_id: string }> = [];
    selectedFlagsByScenario.forEach((flagIds, scenarioId) => {
      flagIds.forEach((flagId) => {
        values.push({ scenario_id: scenarioId, flag_id: flagId });
      });
    });
    onScenarioFlagValuesRef.current(values);
  }, [selectedFlagsByScenario]);

  const handleToggle = useCallback(
    (scenarioId: string, flagId: string, checked: boolean) => {
      isDirtyRef.current = true;
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

      if (!checked) {
        setScenarioFlagResourceIds((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
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
          icon: flag.icon ?? undefined,
        });
      });

    return map;
  }, [allFlags]);

  // Filter flags based on scenario's show_x_flag booleans from backend
  const filteredFlagOptionsByScenario = useMemo(() => {
    const map = new Map<string, ScenarioFlagOption[]>();

    flagOptionsByScenario.forEach((flags, scenarioId) => {
      const scenarioConfig = scenario_resources?.find(
        (s) => (s.scenario_id || s.id) === scenarioId
      );

      // If no scenario config found, show all flags (backwards compatibility)
      if (!scenarioConfig) {
        map.set(scenarioId, flags);
        return;
      }

      const filtered = flags.filter((flag) => {
        const flagName = flag.name.toLowerCase();

        // Map flag names to show_* booleans
        if (flagName === "show_problem_statement") {
          return scenarioConfig.show_problem_statement !== false;
        }
        if (flagName === "show_objectives") {
          return scenarioConfig.show_objectives !== false;
        }
        if (flagName === "text_enabled") {
          return scenarioConfig.show_text !== false;
        }
        if (flagName === "audio_enabled") {
          return scenarioConfig.show_audio !== false;
        }
        if (flagName === "copy_paste_allowed") {
          return scenarioConfig.show_copy_paste !== false;
        }
        if (flagName === "show_images" || flagName === "image_input_active") {
          return scenarioConfig.show_images !== false;
        }
        if (flagName === "hints_enabled") {
          return scenarioConfig.show_hints !== false;
        }
        // show_video, show_questions, show_templates don't have corresponding flags yet
        // but are available for future use

        // Show all other flags by default
        return true;
      });

      map.set(scenarioId, filtered);
    });

    return map;
  }, [flagOptionsByScenario, scenario_resources]);

  // Accept pending — pending flags are already reflected in form state, no-op
  const handleAccept = useCallback(() => {
    // Pending flags are already reflected in form state — nothing to change
    // The next draft save will persist them as active
  }, []);

  // Reject pending — unset pending flags
  const handleReject = useCallback(() => {
    for (const resource of pendingResources) {
      if (resource.scenario_id && resource.flag_id) {
        handleToggle(resource.scenario_id, resource.flag_id, false);
      }
    }
  }, [pendingResources, handleToggle]);

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
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);
          const selectedFlags =
            selectedFlagsByScenario.get(scenarioId) ?? new Set<string>();
          const scenarioOptions = filteredFlagOptionsByScenario.get(scenarioId) ?? [];
          return (
            <div
              key={scenarioId}
              className="space-y-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {scenarioOptions.map((option) => {
                  const isSelected = selectedFlags.has(option.id);
                  const isPending =
                    pendingByScenario.get(scenarioId)?.has(option.id) ?? false;
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "space-y-1 p-2 rounded-lg transition-all",
                        isPending && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`flag-${scenarioId}-${option.id}`}
                          className="text-sm flex items-center gap-1 flex-1"
                        >
                          {option.icon ? (
                            <SvgIcon svg={option.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {option.name}
                          {isPending && (
                            <span className="ml-2 text-xs text-success font-medium">
                              Pending
                            </span>
                          )}
                        </Label>
                        <Switch
                          id={`flag-${scenarioId}-${option.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleToggle(scenarioId, option.id, checked)
                          }
                          disabled={disabled}
                        />
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground pl-5">
                          {option.description}
                        </p>
                      )}
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
      </div>
    </div>
  );
}
