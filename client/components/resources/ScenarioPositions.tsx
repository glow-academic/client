/**
 * ScenarioPositions.tsx
 * Resource component for managing scenario positions/ordering within simulations
 * Manages scenario_position_ids array and position values
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
import { useSocket } from "@/contexts/socket-context";
import { Check, ChevronLeft, ChevronRight, GripVertical, Loader2, Sparkles, X } from "lucide-react";
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
type ScenarioPositionGetResponse = OutputOf<"/api/v4/resources/scenario_positions/get", "post">;
export type ScenarioPositionResourceItem = NonNullable<ScenarioPositionGetResponse["items"]>[number];

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
        input: CreateDraftScenarioPositionsIn
      ) => Promise<CreateDraftScenarioPositionsOut>)
    | undefined;
  onPositionIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ scenario_position_ids: string[] } | void>) => void;
  // AI diff view props
  aiScenarioPositionResources?: Pick<ScenarioPositionResourceItem, "id" | "scenario_id" | "value">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
}

export function ScenarioPositions({
  scenario_position_ids,
  scenario_position_resources,
  show_scenario_positions = false,
  scenario_position_suggestions,
  scenario_positions,
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
  isGenerating = false,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiScenarioPositionResources,
  onAccept,
  onReject,
  onGenerationComplete,
}: ScenarioPositionsProps) {
  const show = show_scenario_positions ?? false;
  const allPositions = useMemo(() => scenario_positions ?? [], [scenario_positions]);
  const currentPositions = useMemo(
    () => scenario_position_resources ?? [],
    [scenario_position_resources]
  );
  const scenarioPositionIds = useMemo(
    () => scenario_position_ids ?? [],
    [scenario_position_ids]
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

  // Socket-based AI suggestion handling
  const { socket: aiSocket, isConnected: aiIsConnected } = useSocket();
  const [internalAiScenarioPositionResources, setInternalAiScenarioPositionResources] = useState<
    Pick<ScenarioPositionResourceItem, "id" | "scenario_id" | "value">[] | null
  >(null);

  useEffect(() => {
    if (!aiSocket || !aiIsConnected) return;
    const handleResourceComplete = (data: {
      group_id?: string;
      id?: string | null;
      scenario_id?: string | null;
      value?: number | null;
    }) => {
      if (group_id && data.group_id !== group_id) return;
      if (data.id) {
        setInternalAiScenarioPositionResources([
          { id: data.id, scenario_id: data.scenario_id ?? null, value: data.value ?? null },
        ]);
      }
      onGenerationComplete?.();
    };
    aiSocket.on("scenario_positions_generation_complete", handleResourceComplete);
    return () => {
      aiSocket.off("scenario_positions_generation_complete", handleResourceComplete);
    };
  }, [aiSocket, aiIsConnected, group_id, onGenerationComplete]);

  // Effective AI resources: internal (socket) takes priority, then prop fallback
  const effectiveAiScenarioPositionResources =
    internalAiScenarioPositionResources ?? aiScenarioPositionResources ?? null;

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
  const createdPositionKeysRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ scenario_position_ids: string[] } | void>) | null>(null);

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
  flushRef.current = async (): Promise<{ scenario_position_ids: string[] } | void> => {
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
    }
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
        updated.entries()
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
    ]
  );

  const handleMoveLeft = useCallback(
    (scenarioId: string) => {
      const currentPos = localPositions.get(scenarioId) || 1;
      if (currentPos > 1) {
        handlePositionChange(scenarioId, currentPos - 1);
        // Swap with scenario at position - 1
        const swapScenario = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos - 1
        );
        if (swapScenario) {
          handlePositionChange(swapScenario[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange]
  );

  const handleMoveRight = useCallback(
    (scenarioId: string) => {
      const currentPos = localPositions.get(scenarioId) || 1;
      const maxPos = Math.max(...Array.from(localPositions.values()));
      if (currentPos < maxPos) {
        handlePositionChange(scenarioId, currentPos + 1);
        // Swap with scenario at position + 1
        const swapScenario = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos + 1
        );
        if (swapScenario) {
          handlePositionChange(swapScenario[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange]
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
          .filter(Boolean) as string[]
      ),
    [effectiveAiScenarioPositionResources]
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
      newPositions.entries()
    ).map(([sid, value]) => ({
      simulation_id: simulation_id || "",
      scenario_id: sid,
      value,
      generated: false,
    }));
    onChange(positionsArray);
    onAccept?.();
  }, [aiScenarioPositionResources, localPositions, simulation_id, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
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
      {showDiff && aiScenarioPositionResources && aiScenarioPositionResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Positions</p>
          <div className="flex gap-3 overflow-x-auto py-2 pb-3 px-2">
            {aiScenarioPositionResources.map((item, idx) => {
              const labelText = item.scenario_id
                ? scenarioLabelMap.get(item.scenario_id) ?? "Untitled scenario"
                : "Untitled scenario";
              return (
                <div
                  key={item.id || item.scenario_id || idx}
                  className={cn(
                    "p-3 rounded-lg border-2 border-success bg-success/10",
                    "text-sm h-[88px] w-[180px] flex-shrink-0"
                  )}
                >
                  <div className="font-medium">{labelText}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Position: {item.value ?? "N/A"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="pl-4">
        <div className="flex gap-3 overflow-x-auto py-2 pb-3 px-2 w-0 min-w-full">
          {sortedScenarios.map((scenarioId) => {
            const position = localPositions.get(scenarioId) || 1;
            const maxPos = Math.max(...Array.from(localPositions.values()));
            const labelText = scenarioLabelMap.get(scenarioId) ?? "Untitled scenario";
            const isAiSuggested = showDiff && aiSuggestedIds.has(scenarioId);
            return (
              <div
                key={scenarioId}
                className={cn(
                  "relative flex flex-col justify-between p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px] w-[180px] flex-shrink-0 hover:shadow-md hover:bg-accent/50",
                  isAiSuggested && "ring-2 ring-success bg-success/10"
                )}
              >
                {/* AI suggested badge */}
                {isAiSuggested && (
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    AI Suggested
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0 mt-0.5" />
                  <h3 className="font-medium text-sm leading-tight line-clamp-2 pr-16" title={labelText}>
                    {labelText}
                  </h3>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveLeft(scenarioId)}
                    disabled={disabled || position <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveRight(scenarioId)}
                    disabled={disabled || position >= maxPos}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
