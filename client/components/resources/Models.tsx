/**
 * Models.tsx
 * Resource component for model selection
 * Uses GenericPicker for selection
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

type CreateDraftModelsIn = InputOf<"/api/v4/resources/models", "post">;
type CreateDraftModelsOut = OutputOf<"/api/v4/resources/models", "post">;

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
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createModelsAction?:
    | ((input: CreateDraftModelsIn) => Promise<CreateDraftModelsOut>)
    | undefined;
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
}

export function Models({
  model_id,
  model_resource,
  show_models = true,
  model_suggestions,
  models,
  disabled = false,
  onModelIdChange,
  onGenerate,
  isGenerating = false,
  label = "Model",
  placeholder = "Select a model",
  required = false,
  id = "model",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createModelsAction,
  // Legacy props for backward compatibility
  modelResource,
  modelId: _modelId,
  suggestions,
}: ModelsProps) {
  // Use standardized props with fallback to legacy props
  const resource = model_resource ?? modelResource ?? null;
  const resourceId = model_id ?? _modelId ?? null;
  const show = show_models ?? true;
  const suggestionsList = useMemo(
    () => model_suggestions ?? suggestions ?? [],
    [model_suggestions, suggestions]
  );

  // Use models array for GenericPicker items
  const pickerItems = useMemo(() => {
    if (models && models.length > 0) {
      return models;
    }
    return [];
  }, [models]);

  // Don't render if show_models is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
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
                <TooltipContent>
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <GenericPicker
        items={pickerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={(ids) => onModelIdChange(ids[0] || null)}
        multiSelect={false}
        getId={(item) => item.model_id || ""}
        getLabel={(item) => item.name || "Unknown Model"}
        getSearchText={(item) =>
          `${item.name || ""} ${item.description || ""}`.trim()
        }
        renderPreview={(item) => (
          <div className="space-y-1">
            <div className="font-medium">{item.name || "Unknown Model"}</div>
            {item.description && (
              <div className="text-sm text-muted-foreground">
                {item.description}
              </div>
            )}
            {item.input_modalities && item.input_modalities.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Input: {item.input_modalities.join(", ")}
              </div>
            )}
            {item.output_modalities && item.output_modalities.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Output: {item.output_modalities.join(", ")}
              </div>
            )}
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        label={label}
        description={helpText}
        emptyMessage="No models available"
        groupHeading="Models"
        id={id}
        data-testid={dataTestId}
      />
    </div>
  );
}
