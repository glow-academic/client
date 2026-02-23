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
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;

// Derive resource item type from the GET endpoint response
type ScenarioRubricGetResponse = OutputOf<
  "/api/v4/resources/scenario_rubrics/get",
  "post"
>;
export type ScenarioRubricResourceItem = NonNullable<
  ScenarioRubricGetResponse["items"]
>[number];

export interface ScenarioRubricsProps {
  scenario_rubric_ids?: string[];
  scenario_rubric_resources?: ScenarioRubricResourceItem[];
  show_scenario_rubrics?: boolean;
  scenario_rubric_suggestions?: string[];
  scenario_rubrics?: ScenarioRubricResourceItem[];
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
  group_id?: string | null;
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createScenarioRubricsAction?:
    | ((
        input: CreateDraftScenarioRubricsIn,
      ) => Promise<CreateDraftScenarioRubricsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (
    flush: () => Promise<{ scenario_rubric_ids: string[] } | void>,
  ) => void;
  aiScenarioRubricResources?:
    | Pick<ScenarioRubricResourceItem, "id" | "scenario_id" | "rubric_id">[]
    | null;
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
  create_tool_id,
  createScenarioRubricsAction,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiScenarioRubricResources,
}: ScenarioRubricsProps) {
  const show = show_scenario_rubrics ?? false;
  const currentResources = useMemo(
    () => scenario_rubric_resources ?? [],
    [scenario_rubric_resources],
  );
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);

  // Socket-based AI suggestion handling via shared hook
  type AiSuggestionItem = Pick<ScenarioRubricResourceItem, "id" | "scenario_id" | "rubric_id">;
  const {
    isGenerating: aiIsGenerating,
    aiSuggestions,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "scenario_rubrics",
    groupId: group_id,
    accumulate: true,
  });

  // Effective AI resources: hook (socket) takes priority, then prop fallback
  const effectiveAiScenarioRubricResources =
    aiSuggestions.length > 0 ? aiSuggestions : aiScenarioRubricResources ?? null;

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
  // Map resource ID → artifact ID for API calls
  // Note: After SQL fix, API now accepts scenarios_resource.id directly, but we keep mapping for consistency
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((s) => {
      // s.id = scenarios_resource.id, s.scenario_id = scenario_artifact.id (via junction)
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

  const [rubricIdByScenario, setRubricIdByScenario] = useState<
    Map<string, string | null>
  >(new Map());
  const [scenarioRubricIdsByScenario, setScenarioRubricIdsByScenario] =
    useState<Map<string, string>>(new Map());
  const createdRubricKeysRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<
    (() => Promise<{ scenario_rubric_ids: string[] } | void>) | null
  >(null);

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

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{
    scenario_rubric_ids: string[];
  } | void> => {
    const ids = scenario_ids
      .map((scenarioId) => scenarioRubricIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    return { scenario_rubric_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createScenarioRubric = useCallback(
    async (scenarioId: string, rubricId: string) => {
      if (!isAutosaveEnabled || !createScenarioRubricsAction || !group_id) {
        return;
      }
      const key = `${scenarioId}:${rubricId}`;
      if (createdRubricKeysRef.current.has(key)) {
        return;
      }
      createdRubricKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API (now optional since SQL accepts both)
      const artifactScenarioId = artifactIdMap.get(scenarioId) ?? scenarioId;

      try {
        const result = await createScenarioRubricsAction({
          body: {
            group_id: group_id,
            scenario_id: artifactScenarioId,
            rubric_id: rubricId,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });

        if (!result?.id) {
          return;
        }

        // Update state - useEffect will sync to parent via onChange
        setScenarioRubricIdsByScenario((prev) => {
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
      createScenarioRubricsAction,
      create_tool_id,
      group_id,
      artifactIdMap,
    ],
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
        // Clear selection - useEffect will sync to parent via onChange
        setScenarioRubricIdsByScenario((prev) => {
          const next = new Map(prev);
          next.delete(scenarioId);
          return next;
        });
        return;
      }

      // Clear existing before creating new - useEffect will sync to parent via onChange
      setScenarioRubricIdsByScenario((prev) => {
        const next = new Map(prev);
        if (next.has(scenarioId)) {
          next.delete(scenarioId);
        }
        return next;
      });

      void createScenarioRubric(scenarioId, nextRubricId);
    },
    [createScenarioRubric],
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

  const hasGenerated = useMemo(() => {
    return currentResources.some((resource) => resource.generated);
  }, [currentResources]);

  // AI suggestion state
  const showDiff = !!effectiveAiScenarioRubricResources?.length;

  // Set of AI-suggested scenario IDs for styling
  const aiSuggestedScenarioIds = useMemo(
    () =>
      new Set(
        effectiveAiScenarioRubricResources
          ?.map((r) => r.scenario_id)
          .filter(Boolean) as string[],
      ),
    [effectiveAiScenarioRubricResources],
  );

  // Accept AI suggestion - apply AI-suggested rubric assignments
  const handleAccept = useCallback(() => {
    if (!effectiveAiScenarioRubricResources?.length) return;
    effectiveAiScenarioRubricResources.forEach((r) => {
      if (r.scenario_id && r.rubric_id) {
        handleSelect(r.scenario_id, r.rubric_id);
      }
    });
    clearAi();
  }, [effectiveAiScenarioRubricResources, handleSelect, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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
      {/* AI-suggested scenario rubrics preview */}
      {showDiff &&
        effectiveAiScenarioRubricResources &&
        effectiveAiScenarioRubricResources.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-success">
              AI Suggested Scenario Rubrics
            </p>
            <div className="space-y-2">
              {effectiveAiScenarioRubricResources.map((item, idx) => {
                const scenarioLabel =
                  scenarioLabelMap.get(item.scenario_id || "") ??
                  "Unknown scenario";
                const rubricLabel =
                  rubricOptions.find((r) => r.id === item.rubric_id)?.name ??
                  "Unknown rubric";
                return (
                  <div
                    key={
                      item.id || `${item.scenario_id}-${item.rubric_id}` || idx
                    }
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 border-success bg-success/10",
                      "text-sm",
                    )}
                  >
                    <span className="font-medium">{scenarioLabel}:</span>
                    <span>{rubricLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      <div className="space-y-4 pl-4">
        {scenario_ids.map((scenarioId) => {
          const isAiSuggested = aiSuggestedScenarioIds.has(scenarioId);
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? scenarioId.slice(0, 8);
          const selectedRubricId = rubricIdByScenario.get(scenarioId) ?? null;
          const selectedValue =
            selectedRubricId ?? (required ? "" : NONE_OPTION);
          return (
            <div
              key={scenarioId}
              className={cn(
                "space-y-2",
                isAiSuggested &&
                  "ring-2 ring-success bg-success/5 rounded-lg p-2",
              )}
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
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
                renderItem={(option, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                      "hover:shadow-sm hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      option.isNone && "border-dashed text-muted-foreground",
                      isSelected && "ring-2 ring-primary bg-accent",
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
      </div>
    </div>
  );
}
