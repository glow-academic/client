/**
 * ModelRubrics.tsx
 * Resource component for per-model rubric selection
 * Pure UI: displays rubrics per model, reports selections via onChange/onModelRubricValues
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
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ModelRubricResourceItem {
  id?: string | null;
  model_id?: string | null;
  rubric_id?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface ModelRubricsProps {
  model_rubric_resources?: ModelRubricResourceItem[];
  show_model_rubrics?: boolean;
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
  model_rubric_resources,
  show_model_rubrics = false,
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
  onModelRubricValues,
}: ModelRubricsProps) {
  const show = show_model_rubrics ?? false;
  const currentResources = useMemo(
    () => model_rubric_resources ?? [],
    [model_rubric_resources],
  );
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return currentResources.filter((r) => r.pending && r.model_id);
  }, [currentResources]);
  const showDiff = pendingItems.length > 0;
  const pendingModelIds = useMemo(
    () => new Set(pendingItems.map((r) => r.model_id).filter(Boolean) as string[]),
    [pendingItems],
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
        const name = (model.title || model.name)?.trim() || "";
        const descriptionText = model.description?.trim() || "";
        map.set(id, name || descriptionText || "Untitled model");
      }
    });
    return map;
  }, [models, model_resources]);
  const [rubricIdByModel, setRubricIdByModel] = useState<
    Map<string, string | null>
  >(new Map());
  const [modelRubricIdsByModel, setModelRubricIdsByModel] =
    useState<Map<string, string>>(new Map());
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
      }
    },
    [],
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

  // Accept pending — pending items are already in selection, no-op
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending model rubric assignments
  const handleReject = useCallback(() => {
    // Remove pending model IDs from rubricIdByModel and modelRubricIdsByModel
    setRubricIdByModel((prev) => {
      const next = new Map(prev);
      pendingModelIds.forEach((modelId) => {
        next.set(modelId, null);
      });
      return next;
    });
    setModelRubricIdsByModel((prev) => {
      const next = new Map(prev);
      pendingModelIds.forEach((modelId) => {
        next.delete(modelId);
      });
      return next;
    });
  }, [pendingModelIds]);

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
      <div className="space-y-4 pl-4">
        {model_ids.map((modelId) => {
          const isPending = pendingModelIds.has(modelId);
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
                isPending &&
                  "ring-2 ring-success bg-success/10 rounded-lg p-2",
              )}
            >
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium" title={labelText}>
                  {labelText}
                </Label>
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
              </div>
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
