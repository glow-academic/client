/**
 * SimulationPositions.tsx
 * Resource component for managing simulation positions/ordering within cohorts
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

export interface SimulationPositionResourceItem {
  id?: string | null;
  simulation_id?: string | null;
  value?: number | null;
  pending?: boolean | null;
}

export interface SimulationPositionItem {
  simulation_id: string;
  value: number;
  generated?: boolean;
}

export interface SimulationPositionsProps {
  simulation_ids?: string[];
  simulation_resources?: Array<{
    simulation_id: string | null;
    name: string | null;
    description: string | null;
    time_limit: number | null;
    generated?: boolean | null;
  }>;
  simulations?: Array<{
    simulation_id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  show_simulation_positions?: boolean;
  simulation_positions?: SimulationPositionResourceItem[];
  disabled?: boolean;
  onChange: (positions: SimulationPositionItem[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  /** Callback to emit position values for unified draft */
  onSimulationPositionValues?: (positions: Array<{ simulation_id: string; value: number }>) => void;
}

export function SimulationPositions({
  simulation_ids,
  simulation_resources,
  simulations,
  show_simulation_positions = false,
  simulation_positions,
  disabled = false,
  onChange,
  label = "Simulation Positions",
  id = "simulation_positions",
  required = false,
  description,
  onSimulationPositionValues,
}: SimulationPositionsProps) {
  const show = show_simulation_positions ?? false;
  const selectedSimulationIds = useMemo(
    () => simulation_ids ?? [],
    [simulation_ids],
  );
  const currentPositions = useMemo(
    () => simulation_positions ?? [],
    [simulation_positions],
  );

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return currentPositions.filter((p) => p.pending && p.simulation_id);
  }, [currentPositions]);
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.simulation_id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const simulationLabels = useMemo(() => {
    const normalizeDescription = (description?: string | null) => {
      const trimmed = description?.trim() || "";
      if (!trimmed) return null;
      if (trimmed === "0") return null;
      if (/^\d+$/.test(trimmed)) return null;
      const trailingZeroMatch = trimmed.match(/^(.*)\s0$/);
      if (
        trailingZeroMatch &&
        trailingZeroMatch[1] &&
        !/\d/.test(trailingZeroMatch[1])
      ) {
        const withoutTrailingZero = trailingZeroMatch[1].trim();
        return withoutTrailingZero || null;
      }
      return trimmed;
    };
    const map = new Map<string, string>();
    // Use full simulations list as base (available immediately on selection)
    (simulations ?? []).forEach((sim) => {
      if (sim.simulation_id) {
        const name = sim.name?.trim() || null;
        const description = normalizeDescription(sim.description);
        if (name || description) {
          map.set(
            sim.simulation_id,
            name || description || "Untitled simulation",
          );
        }
      }
    });
    // Override with simulation_resources (server-confirmed data takes priority)
    (simulation_resources ?? []).forEach((sim) => {
      if (sim.simulation_id) {
        const name = sim.name?.trim() || null;
        const description = normalizeDescription(sim.description);
        map.set(
          sim.simulation_id,
          name || description || "Untitled simulation",
        );
      }
    });
    return map;
  }, [simulation_resources, simulations]);

  const positionMap = useMemo(() => {
    const map = new Map<string, number>();
    currentPositions.forEach((pos) => {
      if (pos.simulation_id && pos.value !== null) {
        map.set(pos.simulation_id, pos.value);
      }
    });
    return map;
  }, [currentPositions]);

  const [localPositions, setLocalPositions] = useState<Map<string, number>>(
    () => {
      const map = new Map<string, number>();
      selectedSimulationIds.forEach((simulationId, index) => {
        const existingPosition = positionMap.get(simulationId);
        map.set(simulationId, existingPosition ?? index + 1);
      });
      return map;
    },
  );

  // Dirty flag: once the user interacts, stop syncing from server data and
  // stop emitting on pure re-renders (same pattern as Examples.tsx).
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isDirtyRef.current) return;
    const newMap = new Map<string, number>();
    selectedSimulationIds.forEach((simulationId, index) => {
      const existingPosition = positionMap.get(simulationId);
      newMap.set(simulationId, existingPosition ?? index + 1);
    });
    setLocalPositions(newMap);
  }, [selectedSimulationIds, positionMap]);

  // Emit position values for unified draft. Only emit after the user has
  // actually interacted — otherwise the initial sync effect would emit and
  // trigger a spurious save.
  const onSimulationPositionValuesRef = useRef(onSimulationPositionValues);
  onSimulationPositionValuesRef.current = onSimulationPositionValues;
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDirtyRef.current) return;
    if (!onSimulationPositionValuesRef.current) return;
    const values: Array<{ simulation_id: string; value: number }> = [];
    localPositions.forEach((value, simulationId) => {
      values.push({ simulation_id: simulationId, value });
    });
    onSimulationPositionValuesRef.current(values);
  }, [localPositions]);

  const emitPositions = useCallback(
    (updated: Map<string, number>) => {
      const positionsArray: SimulationPositionItem[] = Array.from(
        updated.entries(),
      ).map(([sid, value]) => ({
        simulation_id: sid,
        value,
        generated: false,
      }));
      onChange(positionsArray);
    },
    [onChange],
  );

  const updatePositions = useCallback(
    (updater: (prev: Map<string, number>) => Map<string, number>) => {
      isDirtyRef.current = true;
      setLocalPositions((prev) => {
        const updated = updater(new Map(prev));
        emitPositions(updated);
        return updated;
      });
    },
    [emitPositions],
  );

  const handlePositionChange = useCallback(
    (simulationId: string, newValue: number) => {
      updatePositions((prev) => {
        prev.set(simulationId, newValue);
        return prev;
      });
    },
    [updatePositions],
  );

  const handleMoveUp = useCallback(
    (simulationId: string) => {
      updatePositions((prev) => {
        const currentPos = prev.get(simulationId) || 1;
        if (currentPos <= 1) return prev;
        const targetPos = currentPos - 1;
        let swapId: string | null = null;
        prev.forEach((pos, sid) => {
          if (pos === targetPos) swapId = sid;
        });
        prev.set(simulationId, targetPos);
        if (swapId) {
          prev.set(swapId, currentPos);
        }
        return prev;
      });
    },
    [updatePositions],
  );

  const handleMoveDown = useCallback(
    (simulationId: string) => {
      updatePositions((prev) => {
        const currentPos = prev.get(simulationId) || 1;
        const maxPos = Math.max(...Array.from(prev.values()));
        if (currentPos >= maxPos) return prev;
        const targetPos = currentPos + 1;
        let swapId: string | null = null;
        prev.forEach((pos, sid) => {
          if (pos === targetPos) swapId = sid;
        });
        prev.set(simulationId, targetPos);
        if (swapId) {
          prev.set(swapId, currentPos);
        }
        return prev;
      });
    },
    [updatePositions],
  );

  const sortedSimulations = useMemo(() => {
    return Array.from(localPositions.entries())
      .sort(([, posA], [, posB]) => posA - posB)
      .map(([simulationId]) => simulationId);
  }, [localPositions]);

  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in the positions, just confirm
  const handleAccept = useCallback(() => {
    // Pending items are already included in localPositions — nothing to change
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending simulation IDs from positions
  const handleReject = useCallback(() => {
    updatePositions((prev) => {
      const updated = new Map(prev);
      pendingIds.forEach((simId) => {
        updated.delete(simId);
      });
      return updated;
    });
  }, [updatePositions, pendingIds]);

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
        {sortedSimulations.map((simulationId) => {
          const position = localPositions.get(simulationId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            simulationLabels.get(simulationId) ?? "Untitled simulation";
          const isPending = pendingIds.has(simulationId);
          return (
            <div
              key={simulationId}
              className={cn(
                "flex items-center gap-2 p-2 border rounded-md",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Pending badge */}
              {isPending && (
                <div className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
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
                    handlePositionChange(simulationId, newValue);
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
                  onClick={() => handleMoveUp(simulationId)}
                  disabled={disabled || position <= 1}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveDown(simulationId)}
                  disabled={disabled || position >= maxPos}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {sortedSimulations.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No simulations selected. Select simulations first to manage their
            positions.
          </div>
        )}
      </div>
    </div>
  );
}
