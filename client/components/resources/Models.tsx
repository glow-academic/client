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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

export interface ModelsProps {
  model_id?: string | null; // Current model_id (standardized prop name)
  model_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    active?: boolean | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_models?: boolean; // Whether to show this resource picker
  model_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  models?: Array<{
    model_id: string | null;
    name: string | null;
    description: string | null;
    active?: boolean | null;
    temperature_lower?: number | null;
    temperature_upper?: number | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    temperature_levels?: unknown;
    reasoning_options?: unknown;
    available_voices?: unknown;
  }>; // Array of all available model options
  disabled?: boolean; // Based on can_edit flag
  onModelIdChange: (modelId: string | null) => void; // Update model_id in parent form state
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
  searchTerm?: string; // Search term for filtering models
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to show only selected models
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
  // Legacy props for backward compatibility
  modelResource?: {
    id: string;
    name: string;
    description: string;
    active?: boolean | null;
    generated?: boolean | null;
  } | null;
  modelId?: string | null;
  suggestions?: string[];
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  // AI diff view props
  aiModelResources?: Array<{
    model_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  // Legacy props for backward compatibility
  modelResource: _modelResource,
  modelId: _modelId,
  suggestions,
  link_tool_id,
  // AI diff view props
  aiModelResources,
  onAccept,
  onReject,
}: ModelsProps) {
  // Use standardized props with fallback to legacy props
  const resourceId = model_id ?? _modelId ?? null;
  const show = show_models ?? true;
  const suggestionsList = useMemo(
    () => model_suggestions ?? suggestions ?? [],
    [model_suggestions, suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiModelResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiModelResources
          ?.map((m) => m.model_id)
          .filter(Boolean) as string[]
      ),
    [aiModelResources]
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
      .filter((m) => m.model_id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.model_id!,
        name: m.name!,
        description: m.description || null,
        input_modalities: m.input_modalities || null,
        output_modalities: m.output_modalities || null,
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

  // Accept AI suggestion - set the AI-suggested model
  const handleAccept = useCallback(() => {
    if (!aiModelResources?.length) return;
    const suggestedId = aiModelResources[0]?.model_id;
    if (suggestedId && suggestedId !== resourceId) {
      onModelIdChange(suggestedId);
    }
    onAccept?.();
  }, [aiModelResources, resourceId, onModelIdChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
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
                  {(model.input_modalities || model.output_modalities) && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {model.input_modalities &&
                        model.input_modalities.length > 0 && (
                          <div>Input: {model.input_modalities.join(", ")}</div>
                        )}
                      {model.output_modalities &&
                        model.output_modalities.length > 0 && (
                          <div>Output: {model.output_modalities.join(", ")}</div>
                        )}
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
