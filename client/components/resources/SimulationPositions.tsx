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
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useSocket } from "@/contexts/socket-context";
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

// Derive resource item type from the GET endpoint response
type SimulationPositionGetResponse = OutputOf<
  "/api/v4/resources/simulation_positions/get",
  "post"
>;
export type SimulationPositionResourceItem = NonNullable<
  SimulationPositionGetResponse["items"]
>[number];

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
  group_id?: string | null;
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  onGenerate?: (() => void | Promise<void>) | undefined;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createSimulationPositionsAction?:
    | ((input: {
        body: {
          group_id: string;
          simulation_id: string;
          value: number;
          mcp: boolean;
        };
      }) => Promise<unknown>)
    | undefined;
  // AI diff view props
  aiSimulationPositionResources?:
    | Pick<SimulationPositionResourceItem, "id" | "simulation_id" | "value">[]
    | null;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created positions */
  registerFlush?: (
    flush: () => Promise<{ simulation_position_ids: string[] | null } | void>,
  ) => void;
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
  group_id,
  create_tool_id,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  createSimulationPositionsAction,
  // AI diff view props
  aiSimulationPositionResources,
  onAccept,
  onReject,
  onGenerationComplete,
  isAutosaveEnabled = true,
  registerFlush,
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

  // Socket-based AI suggestion handling
  const { socket: aiSocket, isConnected: aiIsConnected } = useSocket();
  const [
    internalAiSimulationPositionResources,
    setInternalAiSimulationPositionResources,
  ] = useState<
    | Pick<SimulationPositionResourceItem, "id" | "simulation_id" | "value">[]
    | null
  >(null);

  useEffect(() => {
    if (!aiSocket || !aiIsConnected) return;
    const handleResourceComplete = (data: {
      group_id?: string;
      id?: string | null;
      simulation_id?: string | null;
      value?: number | null;
    }) => {
      if (group_id && data.group_id !== group_id) return;
      if (data.id) {
        setInternalAiSimulationPositionResources([
          {
            id: data.id,
            simulation_id: data.simulation_id ?? null,
            value: data.value ?? null,
          },
        ]);
      }
      onGenerationComplete?.();
    };
    aiSocket.on(
      "simulation_positions_generation_complete",
      handleResourceComplete,
    );
    return () => {
      aiSocket.off(
        "simulation_positions_generation_complete",
        handleResourceComplete,
      );
    };
  }, [aiSocket, aiIsConnected, group_id, onGenerationComplete]);

  // Effective AI resources: internal (socket) takes priority, then prop fallback
  const effectiveAiSimulationPositionResources =
    internalAiSimulationPositionResources ??
    aiSimulationPositionResources ??
    null;

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

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<
    | (() => Promise<{ simulation_position_ids: string[] | null } | void>)
    | undefined
  >(undefined);

  useEffect(() => {
    const newMap = new Map<string, number>();
    selectedSimulationIds.forEach((simulationId, index) => {
      const existingPosition = positionMap.get(simulationId);
      newMap.set(simulationId, existingPosition ?? index + 1);
    });
    setLocalPositions(newMap);
  }, [selectedSimulationIds, positionMap]);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{
    simulation_position_ids: string[] | null;
  } | void> => {
    // Skip if no action available
    if (!createSimulationPositionsAction || !group_id) {
      return;
    }

    const positionsArray: SimulationPositionItem[] = Array.from(
      localPositions.entries(),
    ).map(([sid, value]) => ({
      simulation_id: sid,
      value,
      generated: false,
    }));

    if (positionsArray.length === 0) {
      return { simulation_position_ids: null };
    }

    try {
      const createdIds: string[] = [];
      for (const pos of positionsArray) {
        await createSimulationPositionsAction({
          body: {
            group_id: group_id,
            simulation_id: pos.simulation_id,
            value: pos.value,
            mcp: false,
          },
        });
        createdIds.push(pos.simulation_id);
      }
      return { simulation_position_ids: createdIds };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create simulation position resources:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

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

      // Create resource entries for each position - only when autosave is enabled
      if (
        isAutosaveEnabled &&
        createSimulationPositionsAction &&
        create_tool_id &&
        group_id
      ) {
        for (const pos of positionsArray) {
          createSimulationPositionsAction({
            body: {
              group_id: group_id,
              simulation_id: pos.simulation_id,
              value: pos.value,
              mcp: false,
            },
          }).catch((error) => {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create simulation position resource for ${pos.simulation_id}:`,
              error,
            );
          });
        }
      }
    },
    [
      onChange,
      createSimulationPositionsAction,
      create_tool_id,
      group_id,
      isAutosaveEnabled,
    ],
  );

  const updatePositions = useCallback(
    (updater: (prev: Map<string, number>) => Map<string, number>) => {
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

  // AI suggestion state
  const showDiff = !!effectiveAiSimulationPositionResources?.length;

  // Set of AI-suggested simulation IDs for styling
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        effectiveAiSimulationPositionResources
          ?.map((r) => r.simulation_id)
          .filter(Boolean) as string[],
      ),
    [effectiveAiSimulationPositionResources],
  );

  // Accept AI suggestion - apply AI-suggested positions
  const handleAccept = useCallback(() => {
    if (!effectiveAiSimulationPositionResources?.length) return;
    const newPositions = new Map<string, number>();
    effectiveAiSimulationPositionResources.forEach((r) => {
      if (r.simulation_id && r.value != null) {
        newPositions.set(r.simulation_id, r.value);
      }
    });
    // Merge with existing positions
    setLocalPositions((prev) => {
      const merged = new Map(prev);
      newPositions.forEach((value, simId) => {
        merged.set(simId, value);
      });
      emitPositions(merged);
      return merged;
    });
    setInternalAiSimulationPositionResources(null);
    onAccept?.();
  }, [effectiveAiSimulationPositionResources, emitPositions, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    setInternalAiSimulationPositionResources(null);
    onReject?.();
  }, [onReject]);

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
      {showDiff &&
        effectiveAiSimulationPositionResources &&
        effectiveAiSimulationPositionResources.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-success">
              AI Suggested Positions
            </p>
            <div className="space-y-2">
              {effectiveAiSimulationPositionResources.map((item, idx) => (
                <div
                  key={item.id || item.simulation_id || idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border-2 border-success bg-success/10",
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm w-56 truncate">
                    {simulationLabels.get(item.simulation_id || "") ??
                      "Untitled simulation"}
                  </Label>
                  <Label className="text-sm w-20">Position:</Label>
                  <span className="text-sm font-medium">
                    {item.value ?? "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      <div className="space-y-2">
        {sortedSimulations.map((simulationId) => {
          const position = localPositions.get(simulationId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            simulationLabels.get(simulationId) ?? "Untitled simulation";
          const isAiSuggested = aiSuggestedIds.has(simulationId);
          return (
            <div
              key={simulationId}
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
