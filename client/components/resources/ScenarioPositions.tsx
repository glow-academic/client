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
import { ArrowDown, ArrowUp, GripVertical, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioPositionsIn = InputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;
type CreateDraftScenarioPositionsOut = OutputOf<
  "/api/v4/resources/scenario_positions",
  "post"
>;

export interface ScenarioPositionItem {
  simulation_id: string;
  scenario_id: string;
  value: number;
  generated?: boolean;
}

export interface ScenarioPositionsProps {
  scenario_position_ids?: string[]; // Current scenario position resource IDs (composite keys represented as UUIDs)
  scenario_position_resources?: Array<{
    simulation_id: string | null;
    scenario_id: string | null;
    value: number | null;
    generated?: boolean | null;
  }>; // Selected scenario position resources
  show_scenario_positions?: boolean; // Whether to show this resource picker
  scenario_position_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenario_positions?: Array<{
    simulation_id: string | null;
    scenario_id: string | null;
    value: number | null;
    generated?: boolean | null;
  }>; // All available scenario positions from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (positions: ScenarioPositionItem[]) => void; // Update scenario positions in form state
  simulation_id?: string | null; // Current simulation ID (required for creating positions)
  scenario_ids?: string[]; // Current scenario IDs to position
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenarioPositionsAction?:
    | ((
        input: CreateDraftScenarioPositionsIn
      ) => Promise<CreateDraftScenarioPositionsOut>)
    | undefined;
  onPositionIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ScenarioPositions({
  scenario_position_ids,
  scenario_position_resources,
  show_scenario_positions = false,
  scenario_position_suggestions,
  scenario_positions,
  disabled = false,
  onChange,
  simulation_id,
  scenario_ids = [],
  label = "Scenario Positions",
  id = "scenario_positions",
  required = false,
  description,
  group_id,
  agent_id,
  createScenarioPositionsAction,
  onPositionIdsChange,
  onGenerate,
  isGenerating = false,
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
  const [positionIdsByScenario, setPositionIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const createdPositionKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const next = new Map<string, string>();
    currentPositions.forEach((pos, index) => {
      const scenarioId = pos.scenario_id;
      const positionId = scenarioPositionIds[index];
      if (scenarioId && positionId) {
        next.set(scenarioId, positionId);
      }
    });
    setPositionIdsByScenario(next);
  }, [currentPositions, scenarioPositionIds]);

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
    const newMap = new Map<string, number>();
    scenario_ids.forEach((scenarioId, index) => {
      const existingPosition = positionMap.get(scenarioId);
      newMap.set(scenarioId, existingPosition ?? index + 1);
    });
    setLocalPositions(newMap);
  }, [scenario_ids, positionMap]);

  useEffect(() => {
    const shouldCreateResource =
      createScenarioPositionsAction &&
      agent_id &&
      group_id &&
      simulation_id;
    if (!shouldCreateResource) {
      return;
    }

    scenario_ids.forEach((scenarioId, index) => {
      const value = localPositions.get(scenarioId) ?? index + 1;
      const existingId = positionIdsByScenario.get(scenarioId);
      const existingValue = positionMap.get(scenarioId);
      if (existingId && existingValue === value) {
        return;
      }

      const key = `${scenarioId}:${value}`;
      if (createdPositionKeysRef.current.has(key)) {
        return;
      }
      createdPositionKeysRef.current.add(key);

      void (async () => {
        try {
          const result = await createScenarioPositionsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              simulation_id: simulation_id,
              scenario_id: scenarioId,
              value: value,
              mcp: false,
            },
          });

          if (!result?.id) {
            return;
          }

          setPositionIdsByScenario((prev) => {
            const next = new Map(prev);
            next.set(scenarioId, result.id as string);
            if (onPositionIdsChange) {
              const nextIds = scenario_ids
                .map((id) => next.get(id))
                .filter((id): id is string => Boolean(id));
              onPositionIdsChange(nextIds);
            }
            return next;
          });
        } catch {
          // Resource creation errors are handled by API; keep UI state intact.
        }
      })();
    });
  }, [
    scenario_ids,
    localPositions,
    positionIdsByScenario,
    positionMap,
    createScenarioPositionsAction,
    agent_id,
    group_id,
    simulation_id,
    onPositionIdsChange,
  ]);

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
        createScenarioPositionsAction &&
        agent_id &&
        group_id &&
        simulation_id;
      if (!shouldCreateResource) {
        return;
      }

      void (async () => {
        try {
          const result = await createScenarioPositionsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              simulation_id: simulation_id,
              scenario_id: scenarioId,
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
            if (onPositionIdsChange) {
              const nextIds = scenario_ids
                .map((id) => next.get(id))
                .filter((id): id is string => Boolean(id));
              onPositionIdsChange(nextIds);
            }
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
      createScenarioPositionsAction,
      agent_id,
      group_id,
      onPositionIdsChange,
      scenario_ids,
    ]
  );

  const handleMoveUp = useCallback(
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

  const handleMoveDown = useCallback(
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

  // Don't render if show_scenario_positions is false (AFTER all hooks)
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
                <TooltipContent>Generate Positions</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <div className="space-y-2">
        {sortedScenarios.map((scenarioId) => {
          const position = localPositions.get(scenarioId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          return (
            <div
              key={scenarioId}
              className="flex items-center gap-2 p-2 border rounded-md"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
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
            No scenarios selected. Select scenarios first to manage their positions.
          </div>
        )}
      </div>
    </div>
  );
}
