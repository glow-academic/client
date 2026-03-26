/**
 * ModelRubrics.tsx
 * Resource component for per-model rubric selection
 * Uses base rubrics list and creates model_rubrics_resource entries
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftModelRubricsIn = {
  body: {
    model_id: string;
    rubric_id: string;
    mcp: boolean;
    tool_id?: string;
  };
};
type CreateDraftModelRubricsOut = {
  id?: string | null;
};

export interface ModelRubricResourceItem {
  id?: string | null;
  model_id?: string | null;
  rubric_id?: string | null;
  generated?: boolean | null;
}

export interface ModelRubricsProps {
  model_rubric_ids?: string[];
  model_rubric_resources?: ModelRubricResourceItem[];
  show_model_rubrics?: boolean;
  model_rubric_suggestions?: string[];
  model_rubrics?: ModelRubricResourceItem[];
  rubrics?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  model_ids?: string[];
  models?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
    description?: string | null;
  }>;
  model_resources?: Array<{
    id?: string | null;
    model_id?: string | null;
    name?: string | null;
    title?: string | null; // API returns title, map to name
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
  createModelRubricsAction?:
    | ((
        input: CreateDraftModelRubricsIn,
      ) => Promise<CreateDraftModelRubricsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (
    flush: () => Promise<{ model_rubric_ids: string[] } | void>,
  ) => void;
  aiModelRubricResources?:
    | Pick<ModelRubricResourceItem, "id" | "model_id" | "rubric_id">[]
    | null;
  /** Value callback for unified draft — reports all model+rubric pairs */
  onModelRubricValues?: (rubrics: Array<{ model_id: string; rubric_id: string }>) => void;
}

const NONE_OPTION = "__none__";

type ModelRubricOption = {
  id: string;
  name: string;
  description?: string;
  isNone?: boolean;
};

export function ModelRubrics({
  model_rubric_ids: _model_rubric_ids,
  model_rubric_resources,
  show_model_rubrics = false,
  model_rubric_suggestions: _model_rubric_suggestions,
  model_rubrics: _model_rubrics,
  rubrics,
  model_ids = [],
  models,
  model_resources,
  disabled = false,
  onChange,
  label = "Model Rubrics",
  id = "model_rubrics",
  required = false,
  description,
  group_id,
  create_tool_id,
  createModelRubricsAction,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiModelRubricResources,
  onModelRubricValues,
}: ModelRubricsProps) {
  const show = show_model_rubrics ?? false;
  const currentResources = useMemo(
    () => model_rubric_resources ?? [],
    [model_rubric_resources],
  );
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);

  // Socket-based AI suggestion handling via shared hook
  type _AiSuggestionItem = Pick<ModelRubricResourceItem, "id" | "model_id" | "rubric_id">;
  const {
    isGenerating: aiIsGenerating,
    aiSuggestions,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "model_rubrics",
    groupId: group_id,
    accumulate: true,
  });

  // Effective AI resources: hook (socket) takes priority, then prop fallback
  const effectiveAiModelRubricResources =
    aiSuggestions.length > 0 ? aiSuggestions : aiModelRubricResources ?? null;

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
        const name = (model.title || model.name)?.trim() || "";
        const descriptionText = model.description?.trim() || "";
        map.set(id, name || descriptionText || "Untitled model");
      }
    });
    return map;
  }, [models, model_resources]);
  // Map resource ID -> artifact ID for API calls
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (models ?? []).forEach((m) => {
      // m.id = models_resource.id, m.model_id = model_artifact.id (via junction)
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

  const [rubricIdByModel, setRubricIdByModel] = useState<
    Map<string, string | null>
  >(new Map());
  const [modelRubricIdsByModel, setModelRubricIdsByModel] =
    useState<Map<string, string>>(new Map());
  const createdRubricKeysRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<
    (() => Promise<{ model_rubric_ids: string[] } | void>) | null
  >(null);

  useEffect(() => {
    const nextRubrics = new Map<string, string | null>();
    const nextIds = new Map<string, string>();

    currentResources.forEach((resource) => {
      if (resource.model_id) {
        nextRubrics.set(resource.model_id, resource.rubric_id ?? null);
        if (resource.id) {
          nextIds.set(resource.model_id, resource.id);
        }
      }
    });

    model_ids.forEach((modelId) => {
      if (!nextRubrics.has(modelId)) {
        nextRubrics.set(modelId, null);
      }
    });

    // Only update if content actually changed
    setRubricIdByModel((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextRubrics.entries()).sort());
      return prevKey === nextKey ? prev : nextRubrics;
    });
    setModelRubricIdsByModel((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
  }, [currentResources, model_ids]);

  // Sync modelRubricIdsByModel to parent via onChange (must be in useEffect, not during setState)
  // Use ref for onChange to avoid dependency that changes every render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const ids = model_ids
      .map((modelId) => modelRubricIdsByModel.get(modelId))
      .filter((value): value is string => Boolean(value));
    // Only emit if IDs actually changed to prevent infinite loops
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onChangeRef.current(ids);
    }
  }, [modelRubricIdsByModel, model_ids]);

  // Emit value callback for unified draft pattern
  const onModelRubricValuesRef = useRef(onModelRubricValues);
  onModelRubricValuesRef.current = onModelRubricValues;
  useEffect(() => {
    if (!onModelRubricValuesRef.current) return;
    const values: Array<{ model_id: string; rubric_id: string }> = [];
    rubricIdByModel.forEach((rubricId, modelId) => {
      if (rubricId) {
        values.push({ model_id: modelId, rubric_id: rubricId });
      }
    });
    onModelRubricValuesRef.current(values);
  }, [rubricIdByModel]);

  // Update flush function - returns current IDs from local state
  flushRef.current = async (): Promise<{
    model_rubric_ids: string[];
  } | void> => {
    const ids = model_ids
      .map((modelId) => modelRubricIdsByModel.get(modelId))
      .filter((value): value is string => Boolean(value));
    return { model_rubric_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createModelRubric = useCallback(
    async (modelId: string, rubricId: string) => {
      if (!isAutosaveEnabled || !createModelRubricsAction || !group_id) {
        return;
      }
      const key = `${modelId}:${rubricId}`;
      if (createdRubricKeysRef.current.has(key)) {
        return;
      }
      createdRubricKeysRef.current.add(key);

      // Resolve resource ID to artifact ID for the API (now optional since SQL accepts both)
      const artifactModelId = artifactIdMap.get(modelId) ?? modelId;

      try {
        const result = await createModelRubricsAction({
          body: {
            model_id: artifactModelId,
            rubric_id: rubricId,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });

        if (!result?.id) {
          return;
        }

        // Update state - useEffect will sync to parent via onChange
        setModelRubricIdsByModel((prev) => {
          const next = new Map(prev);
          next.set(modelId, result.id as string);
          return next;
        });
      } catch {
        // Resource creation errors are handled by API; keep UI state intact.
      }
    },
    [
      isAutosaveEnabled,
      createModelRubricsAction,
      create_tool_id,
      group_id,
      artifactIdMap,
    ],
  );

  const handleSelect = useCallback(
    (modelId: string, value: string) => {
      const nextRubricId = value === NONE_OPTION ? null : value;

      setRubricIdByModel((prev) => {
        const next = new Map(prev);
        next.set(modelId, nextRubricId);
        return next;
      });

      if (nextRubricId === null) {
        // Clear selection - useEffect will sync to parent via onChange
        setModelRubricIdsByModel((prev) => {
          const next = new Map(prev);
          next.delete(modelId);
          return next;
        });
        return;
      }

      // Clear existing before creating new - useEffect will sync to parent via onChange
      setModelRubricIdsByModel((prev) => {
        const next = new Map(prev);
        if (next.has(modelId)) {
          next.delete(modelId);
        }
        return next;
      });

      void createModelRubric(modelId, nextRubricId);
    },
    [createModelRubric],
  );

  const rubricOptions = useMemo<ModelRubricOption[]>(() => {
    return allRubrics
      .filter((rubric) => rubric.id && rubric.name)
      .map((rubric) => ({
        id: rubric.id as string,
        name: rubric.name as string,
        description: rubric.description ?? "",
      }));
  }, [allRubrics]);

  const gridOptions = useMemo(() => {
    if (required) {
      return rubricOptions;
    }
    return [
      {
        id: NONE_OPTION,
        name: "No rubric",
        description: "Clear selection",
        isNone: true,
      },
      ...rubricOptions,
    ];
  }, [required, rubricOptions]);

  const hasGenerated = useMemo(() => {
    return currentResources.some((resource) => resource.generated);
  }, [currentResources]);

  // AI suggestion state
  const showDiff = !!effectiveAiModelRubricResources?.length;

  // Set of AI-suggested model IDs for styling
  const aiSuggestedModelIds = useMemo(
    () =>
      new Set(
        effectiveAiModelRubricResources
          ?.map((r) => r.model_id)
          .filter(Boolean) as string[],
      ),
    [effectiveAiModelRubricResources],
  );

  // Accept AI suggestion - apply AI-suggested rubric assignments
  const handleAccept = useCallback(() => {
    if (!effectiveAiModelRubricResources?.length) return;
    effectiveAiModelRubricResources.forEach((r) => {
      if (r.model_id && r.rubric_id) {
        handleSelect(r.model_id, r.rubric_id);
      }
    });
    clearAi();
  }, [effectiveAiModelRubricResources, handleSelect, clearAi]);

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
      {/* AI-suggested model rubrics preview */}
      {showDiff &&
        effectiveAiModelRubricResources &&
        effectiveAiModelRubricResources.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-success">
              AI Suggested Model Rubrics
            </p>
            <div className="space-y-2">
              {effectiveAiModelRubricResources.map((item, idx) => {
                const modelLabel =
                  modelLabelMap.get(item.model_id || "") ??
                  "Unknown model";
                const rubricLabel =
                  rubricOptions.find((r) => r.id === item.rubric_id)?.name ??
                  "Unknown rubric";
                return (
                  <div
                    key={
                      item.id || `${item.model_id}-${item.rubric_id}` || idx
                    }
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border-2 border-success bg-success/10",
                      "text-sm",
                    )}
                  >
                    <span className="font-medium">{modelLabel}:</span>
                    <span>{rubricLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      <div className="space-y-4 pl-4">
        {model_ids.map((modelId) => {
          const isAiSuggested = aiSuggestedModelIds.has(modelId);
          const labelText =
            modelLabelMap.get(modelId) ?? modelId.slice(0, 8);
          const selectedRubricId = rubricIdByModel.get(modelId) ?? null;
          const selectedValue =
            selectedRubricId ?? (required ? "" : NONE_OPTION);
          return (
            <div
              key={modelId}
              className={cn(
                "space-y-2",
                isAiSuggested &&
                  "ring-2 ring-success bg-success/5 rounded-lg p-2",
              )}
            >
              <Label className="text-sm font-medium" title={labelText}>
                {labelText}
              </Label>
              <SelectableGrid<ModelRubricOption>
                horizontal
                items={gridOptions}
                selectedId={selectedValue}
                onSelect={(optionId) => {
                  if (optionId === NONE_OPTION) {
                    handleSelect(modelId, NONE_OPTION);
                    return;
                  }
                  if (!required && optionId === selectedRubricId) {
                    handleSelect(modelId, NONE_OPTION);
                    return;
                  }
                  handleSelect(modelId, optionId);
                }}
                getId={(option) => option.id}
                renderItem={(option, isSelected) => (
                  <div
                    className={cn(
                      "relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                      "hover:shadow-sm hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      option.isNone && "border-dashed text-muted-foreground",
                      isSelected && "ring-2 ring-primary bg-accent",
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    <div className="text-sm font-medium">{option.name}</div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {option.description}
                      </div>
                    )}
                  </div>
                )}
                emptyMessage="No rubrics available."
                maxHeight="max-h-[220px]"
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
