/**
 * ScenarioPositions.tsx
 * Resource component for managing scenario positions/ordering within simulations
 * Manages scenario_position_ids array and position values
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
import { cn } from "@/lib/utils";
import { useResourceAi } from "@/hooks/use-resource-ai";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;

// Derive resource item type from the GET endpoint response
type ScenarioPositionGetResponse = OutputOf<
  "/api/v4/resources/scenario_positions/get",
  "post"
>;
export type ScenarioPositionResourceItem = NonNullable<
  ScenarioPositionGetResponse["items"]
>[number];

export interface ScenarioPositionItem {
  simulation_id: string;
  scenario_id: string;
  value: number;
  generated?: boolean;
}

export interface ScenarioPositionsProps {
  scenario_position_ids?: string[]; // Current scenario position resource IDs (composite keys represented as UUIDs)
  scenario_position_resources?: ScenarioPositionResourceItem[]; // Selected scenario position resources
  show_scenario_positions?: boolean; // Whether to show this resource picker
  scenario_position_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenario_positions?: ScenarioPositionResourceItem[]; // All available scenario positions from API
  scenarios?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
  }>; // Full scenario list for label lookup
  scenario_resources?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
    generated?: boolean | null;
  }>; // Server-confirmed scenario resources for label lookup
  disabled?: boolean; // Based on can_edit flag
  onChange: (positions: ScenarioPositionItem[]) => void; // Update scenario positions in form state
  simulation_id?: string | null; // Current simulation ID (required for creating positions)
  scenario_ids?: string[]; // Current scenario IDs to position
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createScenarioPositionsAction?:
    | ((
        input: CreateDraftScenarioPositionsIn,
      ) => Promise<CreateDraftScenarioPositionsOut>)
    | undefined;
  onPositionIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (
    flush: () => Promise<{ scenario_position_ids: string[] } | void>,
  ) => void;
  aiScenarioPositionResources?:
    | Pick<ScenarioPositionResourceItem, "id" | "scenario_id" | "value">[]
    | null;
}

export function ScenarioPositions({
  scenario_position_resources,
  show_scenario_positions = false,
  scenarios,
  scenario_resources,
  disabled = false,
  onChange,
  simulation_id,
  scenario_ids = [],
  label = "Scenario Positions",
  id = "scenario_positions",
  required = false,
  description,
  group_id,
  create_tool_id,
  createScenarioPositionsAction,
  onPositionIdsChange,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiScenarioPositionResources,
}: ScenarioPositionsProps) {
  const show = show_scenario_positions ?? false;
  const currentPositions = useMemo(
    () => scenario_position_resources ?? [],
    [scenario_position_resources],
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
        const name = (scenario.title || scenario.name)?.trim() || null;
        const desc = scenario.description?.trim() || null;
        map.set(id, name || desc || "Untitled scenario");
      }
    });
    return map;
  }, [scenarios, scenario_resources]);

  // Socket-based AI suggestion handling via shared hook
  type AiPositionSuggestion = Pick<ScenarioPositionResourceItem, "id" | "scenario_id" | "value">;
  const {
    isGenerating: aiIsGenerating,
    aiSuggestion,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "scenario_positions",
    groupId: group_id,
  });

  // Effective AI resources: hook suggestion takes priority, then prop fallback
  const effectiveAiScenarioPositionResources =
    aiSuggestion ?? aiScenarioPositionResources ?? null;

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
  const [positionIdsByScenario, setPositionIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const positionIdsByScenarioRef = useRef<Map<string, string>>(new Map());
  // Keep ref in sync with state for use in useEffect without causing loops
  positionIdsByScenarioRef.current = positionIdsByScenario;
  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<
    (() => Promise<{ scenario_position_ids: string[] } | void>) | null
  >(null);

  // Initialize positionIdsByScenario from server resources
  // Use the resource's own id field, NOT index-based correlation with scenarioPositionIds
  useEffect(() => {
    const next = new Map<string, string>();
    currentPositions.forEach((pos) => {
      const scenarioId = pos.scenario_id;
      const positionId = pos.id; // Use the resource's own ID, not index correlation
      if (scenarioId && positionId) {
        next.set(scenarioId, positionId);
      }
    });
    // Only update if content actually changed
    setPositionIdsByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(next.entries()).sort());
      return prevKey === nextKey ? prev : next;
    });
  }, [currentPositions]);

  // Sync positionIdsByScenario to parent via onPositionIdsChange (must be in useEffect, not during setState)
  // Use ref for onPositionIdsChange to avoid dependency that changes every render
  const onPositionIdsChangeRef = useRef(onPositionIdsChange);
  onPositionIdsChangeRef.current = onPositionIdsChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!onPositionIdsChangeRef.current) return;
    const ids = scenario_ids
      .map((scenarioId) => positionIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onPositionIdsChangeRef.current(ids);
    }
  }, [positionIdsByScenario, scenario_ids]);

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{
    scenario_position_ids: string[];
  } | void> => {
    const ids = scenario_ids
      .map((scenarioId) => positionIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    return { scenario_position_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Build position map from current positions
  const positionMap = useMemo(() => {
    const map = new Map<string, number>();
    currentPositions.forEach((pos) => {
      if (pos.scenario_id && pos.value !== null) {
        map.set(pos.scenario_id, pos.value);
      }
    });
    return map;
  }, [currentPositions]);

  // Initialize positions for scenarios that don't have positions yet
  const [localPositions, setLocalPositions] = useState<Map<string, number>>(
    () => {
      const map = new Map<string, number>();
      scenario_ids.forEach((scenarioId, index) => {
        const existingPosition = positionMap.get(scenarioId);
        map.set(scenarioId, existingPosition ?? index + 1);
      });
      return map;
    },
  );

  // Update local positions when scenario_ids or currentPositions change
  useEffect(() => {
    setLocalPositions((prev) => {
      const newMap = new Map<string, number>();
      scenario_ids.forEach((scenarioId, index) => {
        const existingPosition = positionMap.get(scenarioId);
        newMap.set(scenarioId, existingPosition ?? index + 1);
      });
      // Only update if content actually changed
      if (prev.size !== newMap.size) return newMap;
      for (const [key, value] of newMap) {
        if (prev.get(key) !== value) return newMap;
      }
      return prev; // No change, return same reference
    });
  }, [scenario_ids, positionMap]);

  // Auto-creation of positions is now handled only on explicit user action (handlePositionChange)
  // to prevent infinite loops and unwanted API calls on component mount

  const handlePositionChange = useCallback(
    (scenarioId: string, newValue: number) => {
      const updated = new Map(localPositions);
      updated.set(scenarioId, newValue);
      setLocalPositions(updated);

      // Convert to array format for parent
      const positionsArray: ScenarioPositionItem[] = Array.from(
        updated.entries(),
      ).map(([sid, value]) => ({
        simulation_id: simulation_id || "",
        scenario_id: sid,
        value,
        generated: false,
      }));

      onChange(positionsArray);

      const shouldCreateResource =
        isAutosaveEnabled &&
        createScenarioPositionsAction &&
        create_tool_id &&
        group_id &&
        simulation_id;
      if (!shouldCreateResource) {
        return;
      }

      // Resolve resource ID to artifact ID for the API
      const artifactScenarioId = artifactIdMap.get(scenarioId) ?? scenarioId;

      void (async () => {
        try {
          const result = await createScenarioPositionsAction({
            body: {
              group_id: group_id,
              simulation_id: simulation_id,
              scenario_id: artifactScenarioId,
              value: newValue,
              mcp: false,
              tool_id: create_tool_id ?? undefined,
            },
          });

          if (!result?.id) {
            return;
          }

          setPositionIdsByScenario((prev) => {
            const next = new Map(prev);
            next.set(scenarioId, result.id as string);
            return next;
          });
        } catch {
          // Resource creation errors are handled by API; keep UI state intact.
        }
      })();
    },
    [
      localPositions,
      simulation_id,
      onChange,
      isAutosaveEnabled,
      createScenarioPositionsAction,
      create_tool_id,
      group_id,
      onPositionIdsChange,
      scenario_ids,
      artifactIdMap,
    ],
  );

  const handleMoveUp = useCallback(
    (scenarioId: string) => {
      const currentPos = localPositions.get(scenarioId) || 1;
      if (currentPos > 1) {
        handlePositionChange(scenarioId, currentPos - 1);
        const swapScenario = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos - 1,
        );
        if (swapScenario) {
          handlePositionChange(swapScenario[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange],
  );

  const handleMoveDown = useCallback(
    (scenarioId: string) => {
      const currentPos = localPositions.get(scenarioId) || 1;
      const maxPos = Math.max(...Array.from(localPositions.values()));
      if (currentPos < maxPos) {
        handlePositionChange(scenarioId, currentPos + 1);
        const swapScenario = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos + 1,
        );
        if (swapScenario) {
          handlePositionChange(swapScenario[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange],
  );

  // Sort scenarios by position for display
  const sortedScenarios = useMemo(() => {
    return Array.from(localPositions.entries())
      .sort(([, posA], [, posB]) => posA - posB)
      .map(([scenarioId]) => scenarioId);
  }, [localPositions]);

  // AI suggestion state
  const showDiff = !!effectiveAiScenarioPositionResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        effectiveAiScenarioPositionResources
          ?.map((r) => r.scenario_id)
          .filter(Boolean) as string[],
      ),
    [effectiveAiScenarioPositionResources],
  );

  // Accept AI suggestion - apply AI-suggested positions
  const handleAccept = useCallback(() => {
    if (!effectiveAiScenarioPositionResources?.length) return;
    // Apply AI positions to local state
    const newPositions = new Map(localPositions);
    effectiveAiScenarioPositionResources.forEach((pos) => {
      if (pos.scenario_id && pos.value !== null && pos.value !== undefined) {
        newPositions.set(pos.scenario_id, pos.value);
      }
    });
    setLocalPositions(newPositions);
    // Emit changes
    const positionsArray: ScenarioPositionItem[] = Array.from(
      newPositions.entries(),
    ).map(([sid, value]) => ({
      simulation_id: simulation_id || "",
      scenario_id: sid,
      value,
      generated: false,
    }));
    onChange(positionsArray);
    clearAi();
  }, [
    effectiveAiScenarioPositionResources,
    localPositions,
    simulation_id,
    onChange,
    clearAi,
  ]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_scenario_positions is false or no scenarios (AFTER all hooks)
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
                <TooltipContent>Generate Positions</TooltipContent>
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
      {/* AI-suggested positions preview */}
      {showDiff &&
        effectiveAiScenarioPositionResources &&
        effectiveAiScenarioPositionResources.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-success">
              AI Suggested Positions
            </p>
            <div className="space-y-2">
              {effectiveAiScenarioPositionResources.map((item, idx) => {
                const labelText = item.scenario_id
                  ? (scenarioLabelMap.get(item.scenario_id) ??
                    "Untitled scenario")
                  : "Untitled scenario";
                return (
                  <div
                    key={item.id || item.scenario_id || idx}
                    className="flex items-center gap-2 p-2 rounded-lg border-2 border-success bg-success/10"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm w-56 truncate">
                      {labelText}
                    </Label>
                    <Label className="text-sm w-20">Position:</Label>
                    <span className="text-sm font-medium">
                      {item.value ?? "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      <div className="space-y-2">
        {sortedScenarios.map((scenarioId) => {
          const position = localPositions.get(scenarioId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? "Untitled scenario";
          const isAiSuggested = showDiff && aiSuggestedIds.has(scenarioId);
          return (
            <div
              key={scenarioId}
              className={cn(
                "flex items-center gap-2 p-2 border rounded-md",
                isAiSuggested && "ring-2 ring-success bg-success/5",
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm w-56 truncate" title={labelText}>
                {labelText}
              </Label>
              <Label className="text-sm w-20">Position:</Label>
              <Input
                type="number"
                min={1}
                max={maxPos}
                value={position}
                onChange={(e) => {
                  const newValue = parseInt(e.target.value, 10);
                  if (!isNaN(newValue) && newValue >= 1) {
                    handlePositionChange(scenarioId, newValue);
                  }
                }}
                disabled={disabled}
                className="w-20"
              />
              <div className="flex gap-1 ml-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveUp(scenarioId)}
                  disabled={disabled || position <= 1}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveDown(scenarioId)}
                  disabled={disabled || position >= maxPos}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {sortedScenarios.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No scenarios selected. Select scenarios first to manage their
            positions.
          </div>
        )}
      </div>
    </div>
  );
}
