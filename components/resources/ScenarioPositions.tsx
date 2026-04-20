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
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ScenarioPositionResourceItem {
  id?: string | null;
  scenario_id?: string | null;
  value?: number | null;
  pending?: boolean | null;
}

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
  simulation_id?: string | null; // Current simulation ID (required for position items)
  scenario_ids?: string[]; // Current scenario IDs to position
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  onPositionIdsChange?: (ids: string[]) => void;
  /** Value callback for unified draft — reports all scenario+position pairs */
  onScenarioPositionValues?: (positions: Array<{ scenario_id: string; value: number }>) => void;
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
  onPositionIdsChange,
  onScenarioPositionValues,
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

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return currentPositions.filter((p) => p.pending && p.scenario_id);
  }, [currentPositions]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.scenario_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  const [positionIdsByScenario, setPositionIdsByScenario] = useState<
    Map<string, string>
  >(new Map());

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

  // Build position map from current positions
  const positionMap = useMemo(() => {
    const map = new Map<string, number>();
    currentPositions.forEach((pos) => {
      if (pos.scenario_id && pos.value != null) {
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

  // Emit value callback for unified draft pattern
  const onScenarioPositionValuesRef = useRef(onScenarioPositionValues);
  onScenarioPositionValuesRef.current = onScenarioPositionValues;
  useEffect(() => {
    if (!onScenarioPositionValuesRef.current) return;
    const values: Array<{ scenario_id: string; value: number }> = [];
    localPositions.forEach((value, scenarioId) => {
      values.push({ scenario_id: scenarioId, value });
    });
    onScenarioPositionValuesRef.current(values);
  }, [localPositions]);

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
    },
    [localPositions, simulation_id, onChange],
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

  // Accept pending — keep pending positions in selection (no-op, already included)
  const handleAccept = useCallback(() => {
    // Pending items are already in positions (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending positions from selection
  const handleReject = useCallback(() => {
    // Remove pending scenario IDs from localPositions and emit
    const newPositions = new Map(localPositions);
    pendingIds.forEach((sid) => newPositions.delete(sid));
    setLocalPositions(newPositions);
    const positionsArray: ScenarioPositionItem[] = Array.from(
      newPositions.entries(),
    ).map(([sid, value]) => ({
      simulation_id: simulation_id || "",
      scenario_id: sid,
      value,
      generated: false,
    }));
    onChange(positionsArray);
  }, [localPositions, pendingIds, simulation_id, onChange]);

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
      <div className="space-y-2">
        {sortedScenarios.map((scenarioId) => {
          const position = localPositions.get(scenarioId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            scenarioLabelMap.get(scenarioId) ?? "Untitled scenario";
          const isPending = pendingIds.has(scenarioId);
          return (
            <div
              key={scenarioId}
              className={cn(
                "relative flex items-center gap-2 p-2 border rounded-md",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Pending badge */}
              {isPending && (
                <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
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
