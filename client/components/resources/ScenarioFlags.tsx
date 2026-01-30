/**
 * ScenarioFlags.tsx
 * Resource component for per-scenario flag selection
 * Uses base flags list and creates scenario_flags_resource entries
 */

"use client";

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

  const hasGenerated = useMemo(() => {
    return currentResources.some((flag) => flag.generated);
  }, [currentResources]);

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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {scenarioOptions.map((option) => {
                  const isSelected = selectedFlags.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleToggle(scenarioId, option.id, !isSelected)}
                      disabled={disabled}
                      className={cn(
                        "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                        "hover:shadow-sm hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected && "ring-2 ring-primary bg-accent",
                        disabled && "pointer-events-none opacity-50"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className="text-xs font-medium pr-6">{option.name}</div>
                      {option.description && (
                        <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {option.description}
                        </div>
                      )}
                    </button>
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
