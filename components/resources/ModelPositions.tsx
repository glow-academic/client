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

type CreateDraftModelPositionsIn = {
  body: {
    simulation_id: string;
    model_id: string;
    value: number;
    mcp: boolean;
    tool_id?: string;
  };
};
type CreateDraftModelPositionsOut = {
  id?: string | null;
};

export interface ModelPositionResourceItem {
  id?: string | null;
  model_id?: string | null;
  value?: number | null;
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
  model_position_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
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
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createModelPositionsAction?:
    | ((
        input: CreateDraftModelPositionsIn,
      ) => Promise<CreateDraftModelPositionsOut>)
    | undefined;
  onPositionIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (
    flush: () => Promise<{ model_position_ids: string[] } | void>,
  ) => void;
  aiModelPositionResources?:
    | Pick<ModelPositionResourceItem, "id" | "model_id" | "value">[]
    | null;
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
  group_id,
  create_tool_id,
  createModelPositionsAction,
  onPositionIdsChange,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiModelPositionResources,
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

  // Socket-based AI suggestion handling via shared hook
  type _AiPositionSuggestion = Pick<ModelPositionResourceItem, "id" | "model_id" | "value">;
  const {
    isGenerating: aiIsGenerating,
    aiSuggestion,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "model_positions",
    groupId: group_id,
  });

  // Effective AI resources: hook suggestion takes priority, then prop fallback
  const effectiveAiModelPositionResources =
    aiSuggestion ?? aiModelPositionResources ?? null;

  // Map resource ID → artifact ID for API calls (API expects model_artifact.id)
  // From get_simulation SQL: s.id = models_resource.id, s.model_id = model_artifact.id (via junction)
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (models ?? []).forEach((s) => {
      // s.id = models_resource.id (denormalized), s.model_id = model_artifact.id (canonical)
      if (s.id && s.model_id) {
        map.set(s.id, s.model_id);
      } else if (s.model_id) {
        map.set(s.model_id, s.model_id);
      }
    });
    (model_resources ?? []).forEach((s) => {
      if (s.id && s.model_id) {
        map.set(s.id, s.model_id);
      } else if (s.model_id) {
        map.set(s.model_id, s.model_id);
      }
    });
    return map;
  }, [models, model_resources]);
  const [positionIdsByModel, setPositionIdsByModel] = useState<
    Map<string, string>
  >(new Map());
  const positionIdsByModelRef = useRef<Map<string, string>>(new Map());
  // Keep ref in sync with state for use in useEffect without causing loops
  positionIdsByModelRef.current = positionIdsByModel;
  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<
    (() => Promise<{ model_position_ids: string[] } | void>) | null
  >(null);

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

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{
    model_position_ids: string[];
  } | void> => {
    const ids = model_ids
      .map((modelId) => positionIdsByModel.get(modelId))
      .filter((value): value is string => Boolean(value));
    return { model_position_ids: ids };
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

  // Emit value callback for unified draft pattern
  const onModelPositionValuesRef = useRef(onModelPositionValues);
  onModelPositionValuesRef.current = onModelPositionValues;
  useEffect(() => {
    if (!onModelPositionValuesRef.current) return;
    const values: Array<{ model_id: string; value: number }> = [];
    localPositions.forEach((value, modelId) => {
      values.push({ model_id: modelId, value });
    });
    onModelPositionValuesRef.current(values);
  }, [localPositions]);

  // Auto-creation of positions is now handled only on explicit user action (handlePositionChange)
  // to prevent infinite loops and unwanted API calls on component mount

  const handlePositionChange = useCallback(
    (modelId: string, newValue: number) => {
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

      const shouldCreateResource =
        isAutosaveEnabled &&
        createModelPositionsAction &&
        create_tool_id &&
        group_id &&
        simulation_id;
      if (!shouldCreateResource) {
        return;
      }

      // Resolve resource ID to artifact ID for the API
      const artifactModelId = artifactIdMap.get(modelId) ?? modelId;

      void (async () => {
        try {
          const result = await createModelPositionsAction({
            body: {
              simulation_id: simulation_id,
              model_id: artifactModelId,
              value: newValue,
              mcp: false,
              tool_id: create_tool_id ?? undefined,
            },
          });

          if (!result?.id) {
            return;
          }

          setPositionIdsByModel((prev) => {
            const next = new Map(prev);
            next.set(modelId, result.id as string);
            return next;
          });
        } catch {
          // Resource creation errors are handled by API; keep UI state intact.
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      localPositions,
      simulation_id,
      onChange,
      isAutosaveEnabled,
      createModelPositionsAction,
      create_tool_id,
      group_id,
      onPositionIdsChange,
      model_ids,
      artifactIdMap,
    ],
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

  // AI suggestion state
  const showDiff = !!effectiveAiModelPositionResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        effectiveAiModelPositionResources
          ?.map((r) => r.model_id)
          .filter(Boolean) as string[],
      ),
    [effectiveAiModelPositionResources],
  );

  // Accept AI suggestion - apply AI-suggested positions
  const handleAccept = useCallback(() => {
    if (!effectiveAiModelPositionResources?.length) return;
    // Apply AI positions to local state
    const newPositions = new Map(localPositions);
    effectiveAiModelPositionResources.forEach((pos) => {
      if (pos.model_id && pos.value !== null && pos.value !== undefined) {
        newPositions.set(pos.model_id, pos.value);
      }
    });
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
    clearAi();
  }, [
    effectiveAiModelPositionResources,
    localPositions,
    simulation_id,
    onChange,
    clearAi,
  ]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
        effectiveAiModelPositionResources &&
        effectiveAiModelPositionResources.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-success">
              AI Suggested Positions
            </p>
            <div className="space-y-2">
              {effectiveAiModelPositionResources.map((item, idx) => {
                const labelText = item.model_id
                  ? (modelLabelMap.get(item.model_id) ??
                    "Untitled model")
                  : "Untitled model";
                return (
                  <div
                    key={item.id || item.model_id || idx}
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
        {sortedModels.map((modelId) => {
          const position = localPositions.get(modelId) || 1;
          const maxPos = Math.max(...Array.from(localPositions.values()));
          const labelText =
            modelLabelMap.get(modelId) ?? "Untitled model";
          const isAiSuggested = showDiff && aiSuggestedIds.has(modelId);
          return (
            <div
              key={modelId}
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
