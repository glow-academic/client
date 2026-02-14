/**
 * Models.tsx
 * Resource component for model selection
 * Uses SelectableGrid for selection with search and filter
 * Creates resources independently and reports resource IDs to parent
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
import { useSocket } from "@/contexts/socket-context";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// Derive resource item type from the GET endpoint response
type ModelsGetResponse = OutputOf<"/api/v4/resources/models/get", "post">;
export type ModelResourceItem = NonNullable<ModelsGetResponse["items"]>[number];

export interface ModelsProps {
  model_id?: string | null;
  model_resource?: ModelResourceItem | null;
  show_models?: boolean;
  model_suggestions?: string[];
  models?: ModelResourceItem[];
  disabled?: boolean;
  onModelIdChange: (modelId: string | null) => void;
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  group_id?: string | null;
  // AI diff view props
  aiModelResources?: Array<Pick<ModelResourceItem, "id" | "name">> | null;
  onAccept?: () => void;
  onReject?: () => void;
  onGenerationComplete?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Models({
  model_id,
  model_resource: _model_resource,
  show_models = true,
  model_suggestions,
  models,
  disabled = false,
  onModelIdChange,
  label = "Model",
  required = false,
  id = "model",
  helpText,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
  group_id,
  // AI diff view props
  aiModelResources,
  onAccept,
  onReject,
  onGenerationComplete,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
}: ModelsProps) {
  const resourceId = model_id ?? null;
  const show = show_models ?? true;
  const suggestionsList = useMemo(
    () => model_suggestions ?? [],
    [model_suggestions]
  );

  // Socket-based AI suggestion handling
  const { socket: aiSocket, isConnected: aiIsConnected } = useSocket();
  const [internalAiModelResources, setInternalAiModelResources] = useState<
    Array<Pick<ModelResourceItem, "id" | "name">> | null
  >(null);

  useEffect(() => {
    if (!aiSocket || !aiIsConnected) return;
    const handleResourceComplete = (data: {
      group_id?: string;
      id?: string | null;
      name?: string | null;
    }) => {
      if (group_id && data.group_id !== group_id) return;
      if (data.id) {
        setInternalAiModelResources([{ id: data.id, name: data.name ?? null }]);
      }
      onGenerationComplete?.();
    };
    aiSocket.on("models_generation_complete", handleResourceComplete);
    return () => {
      aiSocket.off("models_generation_complete", handleResourceComplete);
    };
  }, [aiSocket, aiIsConnected, group_id, onGenerationComplete]);

  // Effective AI resources: internal (socket) takes priority, then prop fallback
  const effectiveAiModelResources = internalAiModelResources ?? aiModelResources ?? null;

  // AI suggestion state
  const showDiff = !!effectiveAiModelResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        effectiveAiModelResources
          ?.map((m) => m.id)
          .filter(Boolean) as string[]
      ),
    [effectiveAiModelResources]
  );

  // Handle search term changes
  useEffect(() => {
    if (onSearchChange && searchTerm !== undefined) {
      onSearchChange(searchTerm);
    }
  }, [searchTerm, onSearchChange]);

  // Handle showSelected filter changes
  useEffect(() => {
    if (onShowSelectedChange && showSelectedFilter !== undefined) {
      onShowSelectedChange(showSelectedFilter);
    }
  }, [showSelectedFilter, onShowSelectedChange]);

  // Convert models array to items format for SelectableGrid
  const modelsItems = useMemo(() => {
    if (!models || models.length === 0) {
      return [];
    }
    return models
      .filter((m) => m.id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.id!,
        name: m.name!,
        description: m.description || null,
        modality_ids: m.modality_ids || null,
      }));
  }, [models]);

  // Filter models by search term
  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) {
      return modelsItems;
    }
    const searchLower = searchTerm.toLowerCase();
    return modelsItems.filter(
      (model) =>
        model.name.toLowerCase().includes(searchLower) ||
        (model.description &&
          model.description.toLowerCase().includes(searchLower))
    );
  }, [modelsItems, searchTerm]);

  // Filter by showSelected if enabled
  const displayModels = useMemo(() => {
    if (!showSelectedFilter) {
      return filteredModels;
    }
    return filteredModels.filter((model) => model.id === resourceId);
  }, [filteredModels, showSelectedFilter, resourceId]);

  // Check if a model is suggested
  const isSuggested = useCallback(
    (modelId: string) => suggestionsList.includes(modelId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (modelId: string) => {
      // Toggle selection: if already selected, unselect; otherwise select
      if (modelId === resourceId) {
        onModelIdChange(null);
      } else {
        onModelIdChange(modelId);
      }
    },
    [resourceId, onModelIdChange]
  );

  // Accept AI suggestion - set the AI-suggested model and clear internal state
  const handleAccept = useCallback(() => {
    if (!effectiveAiModelResources?.length) return;
    const suggestedId = effectiveAiModelResources[0]?.id;
    if (suggestedId && suggestedId !== resourceId) {
      onModelIdChange(suggestedId);
    }
    onAccept?.();
    setInternalAiModelResources(null);
  }, [effectiveAiModelResources, resourceId, onModelIdChange, onAccept]);

  // Reject AI suggestion - clear internal state
  const handleReject = useCallback(() => {
    setInternalAiModelResources(null);
    onReject?.();
  }, [onReject]);

  // Don't render if show_models is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
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

      <SelectableGrid<(typeof modelsItems)[0]>
        horizontal
        items={displayModels}
        selectedId={resourceId || null}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(model, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(model.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}

              {/* Suggested badge - top right */}
              {isSuggested(model.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {model.name || "Unnamed Model"}
                  </h3>
                  {model.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {model.description}
                    </p>
                  )}
                  {model.modality_ids && model.modality_ids.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Modalities: {model.modality_ids.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No models found. Try adjusting your search."
        disabled={disabled}
      />
      {helpText && <p className="text-sm text-muted-foreground">{helpText}</p>}
    </div>
  );
}
