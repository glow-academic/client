/**
 * ModelFlags.tsx
 * Resource component for per-model flag selection
 * Uses base flags list and creates model_flags_resource entries
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { getIconComponent } from "@/utils/icons";
import { cn } from "@/lib/utils";
import { Check, Loader2, Power, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftModelFlagsIn = {
  body: {
    model_id: string;
    flag_id: string;
    mcp: boolean;
  };
};
type CreateDraftModelFlagsOut = {
  model_flags_id?: string | null;
};

export interface ModelFlagResourceItem {
  id?: string | null;
  model_id?: string | null;
  flag_id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  generated?: boolean | null;
}

export interface ModelFlagsProps {
  model_flag_ids?: string[];
  model_flag_resources?: ModelFlagResourceItem[];
  show_model_flags?: boolean;
  model_flags?: ModelFlagResourceItem[];
  model_ids?: string[];
  models?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    description?: string | null;
  }>;
  model_resources?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
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
  createModelFlagsAction?:
    | ((
        input: CreateDraftModelFlagsIn
      ) => Promise<CreateDraftModelFlagsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ model_flag_ids: string[] } | void>) => void;
  aiModelFlagResources?: Pick<ModelFlagResourceItem, "id">[] | null;
  /** Value callback for unified draft — reports all selected model+flag pairs */
  onModelFlagValues?: (flags: Array<{ model_id: string; flag_id: string }>) => void;
}

type ModelFlagOption = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
};

export function ModelFlags({
  model_flag_ids: _model_flag_ids,
  model_flag_resources,
  show_model_flags = false,
  model_flags,
  model_ids = [],
  models,
  model_resources,
  disabled = false,
  onChange,
  label = "Model Flags",
  id = "model_flags",
  required = false,
  description,
  group_id,
  create_tool_id,
  createModelFlagsAction,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiModelFlagResources,
  onModelFlagValues,
}: ModelFlagsProps) {
  const show = show_model_flags ?? false;
  const allFlags = useMemo(() => model_flags ?? [], [model_flags]);
  const currentResources = useMemo(
    () => model_flag_resources ?? [],
    [model_flag_resources]
  );
  const modelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    // Use full models list as base (keyed by model_id to match model_ids)
    (models ?? []).forEach((model) => {
      const modelId = model.model_id || model.id;
      if (modelId) {
        const name = model.name?.trim() || null;
        const desc = model.description?.trim() || null;
        if (name || desc) {
          map.set(modelId, name || desc || "Untitled model");
        }
      }
    });
    // Override with model_resources (server-confirmed data takes priority)
    (model_resources ?? []).forEach((model) => {
      const modelId = model.model_id || model.id;
      if (modelId) {
        const name = model.name?.trim() || "";
        const descriptionText = model.description?.trim() || "";
        map.set(
          modelId,
          name || descriptionText || "Untitled model"
        );
      }
    });
    return map;
  }, [models, model_resources]);
  // Map resource ID → artifact ID for API calls
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (models ?? []).forEach((m) => {
      if (m.id && m.model_id) {
        map.set(m.id, m.model_id);
      } else if (m.model_id) {
        map.set(m.model_id, m.model_id);
      }
    });
    (model_resources ?? []).forEach((m) => {
      if (m.id && m.model_id) {
        map.set(m.id, m.model_id);
      } else if (m.model_id) {
        map.set(m.model_id, m.model_id);
      }
    });
    return map;
  }, [models, model_resources]);

  // Multi-select: maps modelId → Set of selected flagIds
  const [selectedFlagsByModel, setSelectedFlagsByModel] = useState<
    Map<string, Set<string>>
  >(new Map());
  // Maps "modelId:flagId" → model_flags_resource ID (for emitting)
  const [modelFlagResourceIds, setModelFlagResourceIds] = useState<
    Map<string, string>
  >(new Map());
  const createdFlagKeysRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ model_flag_ids: string[] } | void>) | null>(null);

  // Socket-based AI suggestion handling via shared hook
  const {
    isGenerating: aiIsGenerating,
    aiSuggestion: aiSuggestionFromSocket,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "model_flags",
    groupId: group_id,
  });

  // Effective AI resources: hook (socket) takes priority, then prop fallback
  const effectiveAiFlagResources =
    aiSuggestionFromSocket ?? aiModelFlagResources ?? null;

  useEffect(() => {
    const nextSelected = new Map<string, Set<string>>();
    const nextResourceIds = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.model_id && resource.flag_id) {
        if (!nextSelected.has(resource.model_id)) {
          nextSelected.set(resource.model_id, new Set());
        }
        nextSelected.get(resource.model_id)!.add(resource.flag_id);
        if (resource.id) {
          nextResourceIds.set(
            `${resource.model_id}:${resource.flag_id}`,
            resource.id
          );
        }
      }
    });

    model_ids.forEach((modelId) => {
      if (!nextSelected.has(modelId)) {
        nextSelected.set(modelId, new Set());
      }
    });

    // Only update if content actually changed (compare by serializing)
    setSelectedFlagsByModel((prev) => {
      const prevKey = JSON.stringify(
        Array.from(prev.entries()).map(([k, v]) => [k, Array.from(v).sort()])
      );
      const nextKey = JSON.stringify(
        Array.from(nextSelected.entries()).map(([k, v]) => [k, Array.from(v).sort()])
      );
      return prevKey === nextKey ? prev : nextSelected;
    });
    setModelFlagResourceIds((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextResourceIds.entries()).sort());
      return prevKey === nextKey ? prev : nextResourceIds;
    });
  }, [currentResources, model_ids]);

  // Sync modelFlagResourceIds to parent via onChange (must be in useEffect, not during setState)
  // Use ref for onChange to avoid dependency that changes every render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = Array.from(modelFlagResourceIds.values());
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onChangeRef.current(ids);
    }
  }, [modelFlagResourceIds]);

  // Emit value callback for unified draft pattern
  const onModelFlagValuesRef = useRef(onModelFlagValues);
  onModelFlagValuesRef.current = onModelFlagValues;
  useEffect(() => {
    if (!onModelFlagValuesRef.current) return;
    const values: Array<{ model_id: string; flag_id: string }> = [];
    selectedFlagsByModel.forEach((flagIds, modelId) => {
      flagIds.forEach((flagId) => {
        values.push({ model_id: modelId, flag_id: flagId });
      });
    });
    onModelFlagValuesRef.current(values);
  }, [selectedFlagsByModel]);

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{ model_flag_ids: string[] } | void> => {
    const ids = Array.from(modelFlagResourceIds.values());
    return { model_flag_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createModelFlag = useCallback(
    async (modelId: string, flagId: string) => {
      if (!isAutosaveEnabled || !createModelFlagsAction || !group_id) {
        return;
      }
      const key = `${modelId}:${flagId}`;
      if (createdFlagKeysRef.current.has(key)) {
        return;
      }
      createdFlagKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API
      const artifactModelId = artifactIdMap.get(modelId) ?? modelId;

      try {
        const result = await createModelFlagsAction({
          body: {
            model_id: artifactModelId,
            flag_id: flagId,
            mcp: false,
          },
        });

        if (!result?.model_flags_id) {
          return;
        }

        const resultId = result.model_flags_id as string;
        setModelFlagResourceIds((prev) => {
          const next = new Map(prev);
          next.set(key, resultId);
          return next;
        });
      } catch {
        // Resource creation errors are handled by API; keep UI state intact.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isAutosaveEnabled,
      createModelFlagsAction,
      create_tool_id,
      group_id,
      artifactIdMap,
    ]
  );

  const handleToggle = useCallback(
    (modelId: string, flagId: string, checked: boolean) => {
      const key = `${modelId}:${flagId}`;

      setSelectedFlagsByModel((prev) => {
        const next = new Map(prev);
        const flags = new Set(prev.get(modelId) ?? []);
        if (checked) {
          flags.add(flagId);
        } else {
          flags.delete(flagId);
        }
        next.set(modelId, flags);
        return next;
      });

      if (checked) {
        void createModelFlag(modelId, flagId);
      } else {
        setModelFlagResourceIds((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [createModelFlag]
  );

  // Group flags by model_id from the SQL query
  const flagOptionsByModel = useMemo(() => {
    const map = new Map<string, ModelFlagOption[]>();

    allFlags
      .filter((flag) => flag.flag_id && flag.name && flag.model_id)
      .forEach((flag) => {
        const modelId = flag.model_id as string;
        if (!map.has(modelId)) {
          map.set(modelId, []);
        }
        map.get(modelId)!.push({
          id: flag.flag_id as string,
          name: flag.name as string,
          description: flag.description ?? "",
          icon: flag.icon ?? undefined,
        });
      });

    return map;
  }, [allFlags]);

  const hasGenerated = useMemo(() => {
    return currentResources.some((flag) => flag.generated);
  }, [currentResources]);

  // AI suggestion state
  const showDiff = !!effectiveAiFlagResources?.length;
  const aiSuggestedFlagIds = useMemo(
    () =>
      new Set(
        effectiveAiFlagResources?.map((f) => f.id).filter(Boolean) as string[]
      ),
    [effectiveAiFlagResources]
  );

  // Accept AI suggestion - apply all AI-suggested flags
  const handleAccept = useCallback(() => {
    if (!effectiveAiFlagResources?.length) return;

    for (const aiFlag of effectiveAiFlagResources) {
      if (!aiFlag.id) continue;
      // Find which model and flag this applies to
      for (const [modelId, flagOptions] of flagOptionsByModel) {
        const matchingOption = flagOptions.find((opt) => opt.id === aiFlag.id);
        if (matchingOption) {
          handleToggle(modelId, matchingOption.id, true);
        }
      }
    }
    clearAi();
  }, [effectiveAiFlagResources, flagOptionsByModel, handleToggle, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
      <div className="space-y-4 pl-4">
        {model_ids.map((modelId) => {
          const labelText =
            modelLabelMap.get(modelId) ?? modelId.slice(0, 8);
          const selectedFlags =
            selectedFlagsByModel.get(modelId) ?? new Set<string>();
          const modelOptions = flagOptionsByModel.get(modelId) ?? [];
          return (
            <div
              key={modelId}
              className="space-y-2"
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {modelOptions.map((option) => {
                  const isSelected = selectedFlags.has(option.id);
                  const IconComponent = option.icon
                    ? getIconComponent(option.icon)
                    : null;
                  const isAiSuggested =
                    showDiff && aiSuggestedFlagIds.has(option.id);
                  const wouldChange = isAiSuggested && !isSelected; // AI wants to turn this ON
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "space-y-1 p-2 rounded-lg transition-all",
                        isAiSuggested && "ring-2 ring-success bg-success/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`flag-${modelId}-${option.id}`}
                          className="text-sm flex items-center gap-1 flex-1"
                        >
                          {IconComponent ? (
                            <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {option.name}
                          {isAiSuggested && (
                            <span className="ml-2 text-xs text-success font-medium">
                              → {wouldChange ? "ON" : "OFF"} (AI)
                            </span>
                          )}
                        </Label>
                        <Switch
                          id={`flag-${modelId}-${option.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleToggle(modelId, option.id, checked)
                          }
                          disabled={disabled}
                        />
                      </div>
                      {option.description && (
                        <p className="text-xs text-muted-foreground pl-5">
                          {option.description}
                        </p>
                      )}
                    </div>
                  );
                })}
                {modelOptions.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">
                    No model flags available.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
