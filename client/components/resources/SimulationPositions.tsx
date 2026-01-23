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
import { ArrowDown, ArrowUp, GripVertical, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  show_simulation_positions?: boolean;
  simulation_positions?: Array<{
    simulation_id: string | null;
    value: number | null;
    generated?: boolean | null;
    mcp?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (positions: SimulationPositionItem[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  onGenerate?: (() => void | Promise<void>) | undefined;
  isGenerating?: boolean;
  createSimulationPositionsAction?:
    | ((input: {
        body: { agent_id: string; group_id: string; simulation_id: string; value: number; mcp: boolean };
      }) => Promise<unknown>)
    | undefined;
}

export function SimulationPositions({
  simulation_ids,
  simulation_resources,
  show_simulation_positions = false,
  simulation_positions,
  disabled = false,
  onChange,
  label = "Simulation Positions",
  id = "simulation_positions",
  required = false,
  description,
  group_id,
  agent_id,
  onGenerate,
  isGenerating = false,
  createSimulationPositionsAction,
}: SimulationPositionsProps) {
  const show = show_simulation_positions ?? false;
  const selectedSimulationIds = useMemo(
    () => simulation_ids ?? [],
    [simulation_ids]
  );
  const currentPositions = useMemo(
    () => simulation_positions ?? [],
    [simulation_positions]
  );
  const simulationLabels = useMemo(() => {
    const normalizeDescription = (description?: string | null) => {
      const trimmed = description?.trim() || "";
      if (!trimmed) return null;
      if (trimmed === "0") return null;
      if (/^\d+$/.test(trimmed)) return null;
      const trailingZeroMatch = trimmed.match(/^(.*)\s0$/);
      if (trailingZeroMatch && !/\d/.test(trailingZeroMatch[1])) {
        const withoutTrailingZero = trailingZeroMatch[1].trim();
        return withoutTrailingZero || null;
      }
      return trimmed;
    };
    const map = new Map<string, string>();
    (simulation_resources ?? []).forEach((sim) => {
      if (sim.simulation_id) {
        const name = sim.name?.trim() || null;
        const description = normalizeDescription(sim.description);
        map.set(
          sim.simulation_id,
          name || description || "Untitled simulation"
        );
      }
    });
    return map;
  }, [simulation_resources]);

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
    }
  );

  useEffect(() => {
    const newMap = new Map<string, number>();
    selectedSimulationIds.forEach((simulationId, index) => {
      const existingPosition = positionMap.get(simulationId);
      newMap.set(simulationId, existingPosition ?? index + 1);
    });
    setLocalPositions(newMap);
  }, [selectedSimulationIds, positionMap]);

  const emitPositions = useCallback(
    (updated: Map<string, number>) => {
      const positionsArray: SimulationPositionItem[] = Array.from(
        updated.entries()
      ).map(([sid, value]) => ({
        simulation_id: sid,
        value,
        generated: false,
      }));
      onChange(positionsArray);

      // Create resource entries for each position
      if (createSimulationPositionsAction && agent_id && group_id) {
        for (const pos of positionsArray) {
          createSimulationPositionsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              simulation_id: pos.simulation_id,
              value: pos.value,
              mcp: false,
            },
          }).catch((error) => {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create simulation position resource for ${pos.simulation_id}:`,
              error
            );
          });
        }
      }
    },
    [onChange, createSimulationPositionsAction, agent_id, group_id]
  );

  const updatePositions = useCallback(
    (updater: (prev: Map<string, number>) => Map<string, number>) => {
      setLocalPositions((prev) => {
        const updated = updater(new Map(prev));
        emitPositions(updated);
        return updated;
      });
    },
    [emitPositions]
  );

  const handlePositionChange = useCallback(
    (simulationId: string, newValue: number) => {
      updatePositions((prev) => {
        prev.set(simulationId, newValue);
        return prev;
      });
    },
    [updatePositions]
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
    [updatePositions]
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
    [updatePositions]
  );

  const sortedSimulations = useMemo(() => {
    return Array.from(localPositions.entries())
      .sort(([, posA], [, posB]) => posA - posB)
      .map(([simulationId]) => simulationId);
  }, [localPositions]);

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
        {sortedSimulations.map((simulationId) => {
          const position = localPositions.get(simulationId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            simulationLabels.get(simulationId) ?? "Untitled simulation";
          return (
            <div
              key={simulationId}
              className="flex items-center gap-2 p-2 border rounded-md"
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
