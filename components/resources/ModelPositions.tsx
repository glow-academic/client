/**
 * ModelPositions.tsx
 * Resource component for managing model positions/ordering within simulations
 * Manages model_position_ids array and position values
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

export interface ModelPositionResourceItem {
  id?: string | null;
  model_id?: string | null;
  value?: number | null;
  pending?: boolean | null;
}

export interface ModelPositionItem {
  simulation_id: string;
  model_id: string;
  value: number;
  generated?: boolean;
}

export interface ModelPositionsProps {
  model_position_ids?: string[]; // Current model position resource IDs (composite keys represented as UUIDs)
  model_position_resources?: ModelPositionResourceItem[]; // Selected model position resources
  show_model_positions?: boolean; // Whether to show this resource picker
  model_positions?: ModelPositionResourceItem[]; // All available model positions from API
  models?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
  }>; // Full model list for label lookup
  model_resources?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
    generated?: boolean | null;
  }>; // Server-confirmed model resources for label lookup
  disabled?: boolean; // Based on can_edit flag
  onChange: (positions: ModelPositionItem[]) => void; // Update model positions in form state
  simulation_id?: string | null; // Current simulation ID (required for creating positions)
  model_ids?: string[]; // Current model IDs to position
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  onPositionIdsChange?: (ids: string[]) => void;
  /** Value callback for unified draft — reports all model+position pairs */
  onModelPositionValues?: (positions: Array<{ model_id: string; value: number }>) => void;
}

export function ModelPositions({
  model_position_resources,
  show_model_positions = false,
  models,
  model_resources,
  disabled = false,
  onChange,
  simulation_id,
  model_ids = [],
  label = "Model Positions",
  id = "model_positions",
  required = false,
  description,
  onPositionIdsChange,
  onModelPositionValues,
}: ModelPositionsProps) {
  const show = show_model_positions ?? false;
  const currentPositions = useMemo(
    () => model_position_resources ?? [],
    [model_position_resources],
  );
  const modelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full models list as base (keyed by model_id to match model_ids)
    // Handle both naming conventions: API returns model_id/title, but we also support id/name
    (models ?? []).forEach((model) => {
      const id = model.model_id || model.id;
      if (id) {
        const name = (model.title || model.name)?.trim() || null;
        const desc = model.description?.trim() || null;
        if (name || desc) {
          map.set(id, name || desc || "Untitled model");
        }
      }
    });
    // Override with model_resources (server-confirmed data takes priority)
    (model_resources ?? []).forEach((model) => {
      const id = model.model_id || model.id;
      if (id) {
        const name = (model.title || model.name)?.trim() || null;
        const desc = model.description?.trim() || null;
        map.set(id, name || desc || "Untitled model");
      }
    });
    return map;
  }, [models, model_resources]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return currentPositions.filter((p) => p.pending && p.model_id);
  }, [currentPositions]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.model_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  const [positionIdsByModel, setPositionIdsByModel] = useState<
    Map<string, string>
  >(new Map());
  // Dirty flag: only emit values upward after the user has actually interacted;
  // server-sync-driven state changes just re-baseline silently.
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Initialize positionIdsByModel from server resources
  // Use the resource's own id field, NOT index-based correlation with modelPositionIds
  useEffect(() => {
    const next = new Map<string, string>();
    currentPositions.forEach((pos) => {
      const modelId = pos.model_id;
      const positionId = pos.id; // Use the resource's own ID, not index correlation
      if (modelId && positionId) {
        next.set(modelId, positionId);
      }
    });
    // Only update if content actually changed
    setPositionIdsByModel((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(next.entries()).sort());
      return prevKey === nextKey ? prev : next;
    });
  }, [currentPositions]);

  // Sync positionIdsByModel to parent via onPositionIdsChange (must be in useEffect, not during setState)
  // Use ref for onPositionIdsChange to avoid dependency that changes every render
  const onPositionIdsChangeRef = useRef(onPositionIdsChange);
  onPositionIdsChangeRef.current = onPositionIdsChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!onPositionIdsChangeRef.current) return;
    const ids = model_ids
      .map((modelId) => positionIdsByModel.get(modelId))
      .filter((value): value is string => Boolean(value));
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onPositionIdsChangeRef.current(ids);
    }
  }, [positionIdsByModel, model_ids]);

  // Build position map from current positions
  const positionMap = useMemo(() => {
    const map = new Map<string, number>();
    currentPositions.forEach((pos) => {
      if (pos.model_id && pos.value !== null) {
        map.set(pos.model_id, pos.value);
      }
    });
    return map;
  }, [currentPositions]);

  // Initialize positions for models that don't have positions yet
  const [localPositions, setLocalPositions] = useState<Map<string, number>>(
    () => {
      const map = new Map<string, number>();
      model_ids.forEach((modelId, index) => {
        const existingPosition = positionMap.get(modelId);
        map.set(modelId, existingPosition ?? index + 1);
      });
      return map;
    },
  );

  // Update local positions when model_ids or currentPositions change
  useEffect(() => {
    setLocalPositions((prev) => {
      const newMap = new Map<string, number>();
      model_ids.forEach((modelId, index) => {
        const existingPosition = positionMap.get(modelId);
        newMap.set(modelId, existingPosition ?? index + 1);
      });
      // Only update if content actually changed
      if (prev.size !== newMap.size) return newMap;
      for (const [key, value] of newMap) {
        if (prev.get(key) !== value) return newMap;
      }
      return prev; // No change, return same reference
    });
  }, [model_ids, positionMap]);

  // Emit value callback for unified draft pattern. Only emit after user has
  // actually interacted — otherwise the initial sync and every server refresh
  // would emit and trigger spurious saves.
  const onModelPositionValuesRef = useRef(onModelPositionValues);
  onModelPositionValuesRef.current = onModelPositionValues;
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDirtyRef.current) return;
    if (!onModelPositionValuesRef.current) return;
    const values: Array<{ model_id: string; value: number }> = [];
    localPositions.forEach((value, modelId) => {
      values.push({ model_id: modelId, value });
    });
    onModelPositionValuesRef.current(values);
  }, [localPositions]);

  const handlePositionChange = useCallback(
    (modelId: string, newValue: number) => {
      isDirtyRef.current = true;
      const updated = new Map(localPositions);
      updated.set(modelId, newValue);
      setLocalPositions(updated);

      // Convert to array format for parent
      const positionsArray: ModelPositionItem[] = Array.from(
        updated.entries(),
      ).map(([mid, value]) => ({
        simulation_id: simulation_id || "",
        model_id: mid,
        value,
        generated: false,
      }));

      onChange(positionsArray);
    },
    [localPositions, simulation_id, onChange],
  );

  const handleMoveUp = useCallback(
    (modelId: string) => {
      const currentPos = localPositions.get(modelId) || 1;
      if (currentPos > 1) {
        handlePositionChange(modelId, currentPos - 1);
        const swapModel = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos - 1,
        );
        if (swapModel) {
          handlePositionChange(swapModel[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange],
  );

  const handleMoveDown = useCallback(
    (modelId: string) => {
      const currentPos = localPositions.get(modelId) || 1;
      const maxPos = Math.max(...Array.from(localPositions.values()));
      if (currentPos < maxPos) {
        handlePositionChange(modelId, currentPos + 1);
        const swapModel = Array.from(localPositions.entries()).find(
          ([_, pos]) => pos === currentPos + 1,
        );
        if (swapModel) {
          handlePositionChange(swapModel[0], currentPos);
        }
      }
    },
    [localPositions, handlePositionChange],
  );

  // Sort models by position for display
  const sortedModels = useMemo(() => {
    return Array.from(localPositions.entries())
      .sort(([, posA], [, posB]) => posA - posB)
      .map(([modelId]) => modelId);
  }, [localPositions]);

  // Accept pending — keep pending positions in state (no-op, they're already included)
  const handleAccept = useCallback(() => {
    // Pending items are already in localPositions (selected), just confirm
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending positions from local state
  const handleReject = useCallback(() => {
    isDirtyRef.current = true;
    const newPositions = new Map(localPositions);
    for (const pid of pendingIds) {
      newPositions.delete(pid);
    }
    setLocalPositions(newPositions);
    // Emit changes
    const positionsArray: ModelPositionItem[] = Array.from(
      newPositions.entries(),
    ).map(([mid, value]) => ({
      simulation_id: simulation_id || "",
      model_id: mid,
      value,
      generated: false,
    }));
    onChange(positionsArray);
  }, [localPositions, pendingIds, simulation_id, onChange]);

  // Don't render if show_model_positions is false or no models (AFTER all hooks)
  if (!show || model_ids.length === 0) {
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
        {sortedModels.map((modelId) => {
          const position = localPositions.get(modelId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            modelLabelMap.get(modelId) ?? "Untitled model";
          const isPending = pendingIds.has(modelId);
          return (
            <div
              key={modelId}
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
                    handlePositionChange(modelId, newValue);
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
                  onClick={() => handleMoveUp(modelId)}
                  disabled={disabled || position <= 1}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMoveDown(modelId)}
                  disabled={disabled || position >= maxPos}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {sortedModels.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No models selected. Select models first to manage their
            positions.
          </div>
        )}
      </div>
    </div>
  );
}
