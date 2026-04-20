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

export interface ModelResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  modality_ids?: string[] | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ModelsProps {
  model_id?: string | null;
  model_resource?: ModelResourceItem | null;
  show_models?: boolean;
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
}

export function Models({
  model_id,
  model_resource: _model_resource,
  show_models = true,
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
}: ModelsProps) {
  const resourceId = model_id ?? null;
  const show = show_models ?? true;
  const allModels = useMemo(() => models ?? [], [models]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allModels.filter((m) => m.pending && m.id);
  }, [allModels]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((m) => m.id).filter(Boolean) as string[]),
    [pendingItems]
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
    if (allModels.length === 0) {
      return [];
    }
    return allModels
      .filter((m) => m.id && m.name) // Filter out nulls
      .map((m) => ({
        id: m.id!,
        name: m.name!,
        description: m.description || null,
        modality_ids: m.modality_ids || null,
      }));
  }, [allModels]);

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

  // Check if a model is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (modelId: string) => {
      const model = allModels.find((m) => m.id === modelId);
      return model?.suggested === true;
    },
    [allModels]
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

  // Accept pending — keep pending model in selection (no-op, next save persists)
  const handleAccept = useCallback(() => {
    // Pending items are already reflected in the models list
    // The next draft save will persist them as active
  }, []);

  // Reject pending — if selected model is pending, deselect it
  const handleReject = useCallback(() => {
    if (resourceId && pendingIds.has(resourceId)) {
      onModelIdChange(null);
    }
  }, [resourceId, pendingIds, onModelIdChange]);

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
          const isPending = pendingIds.has(model.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* Suggested dot indicator - top right */}
              {isSuggested(model.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
