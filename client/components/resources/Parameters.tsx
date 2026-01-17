/**
 * Parameters.tsx
 * Resource component for parameters selection
 * Uses GenericPicker to select existing parameters artifacts
 * Manages parameter_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftParametersIn = InputOf<"/api/v4/resources/parameters", "post">;
type CreateDraftParametersOut = OutputOf<"/api/v4/resources/parameters", "post">;

export interface ParametersItem {
  id: string;
  name: string;
  description?: string;
}

export interface ParametersProps {
  parameter_ids?: string[]; // Current parameters artifact IDs (standardized prop name)
  parameter_resources?: Array<{
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected parameters resources (each includes generated field)
  show_parameters?: boolean; // Whether to show this resource picker
  parameter_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  parameters?: Array<{
    parameter_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available parameters from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update parameter_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createParametersAction?:
    | ((input: CreateDraftParametersIn) => Promise<CreateDraftParametersOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Parameters({
  parameter_ids,
  parameter_resources,
  show_parameters = false,
  parameter_suggestions,
  parameters,
  disabled = false,
  onChange,
  label = "Parameters",
  id = "parameters",
  required = false,
  placeholder = "Select parameters...",
  description,
  group_id,
  agent_id,
  createParametersAction,
  onGenerate,
  isGenerating = false,
}: ParametersProps) {
  const ids = useMemo(() => parameter_ids ?? [], [parameter_ids]);
  const show = show_parameters ?? false;
  const allParameters = useMemo(() => parameters ?? [], [parameters]);
  const suggestionsList = useMemo(
    () => parameter_suggestions ?? [],
    [parameter_suggestions]
  );

  // Track which parameters IDs have already had resources created
  const createdParametersIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdParametersIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdParametersIdsRef.current.add(id));
  }, [ids]);

  // Convert parameters array to ParametersItem format for GenericPicker
  const parametersItems = useMemo(() => {
    return allParameters
      .filter((p) => p.parameter_id && p.name) // Filter out nulls
      .map((p) => ({
        id: p.parameter_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [allParameters]);

  // Check if a parameters is suggested
  const isSuggested = useCallback(
    (parametersId: string) => suggestionsList.includes(parametersId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdParametersIdsRef.current.has(id)
      );

      // Create resources for newly selected parameters
      if (
        newlySelected.length > 0 &&
        createParametersAction &&
        agent_id &&
        group_id
      ) {
        for (const parametersId of newlySelected) {
          try {
            await createParametersAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                parameter_id: parametersId,
                mcp: false,
              },
            });
            createdParametersIdsRef.current.add(parametersId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create parameters resource for ${parametersId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createParametersAction, agent_id, group_id]
  );

  // Check if any parameters resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return parameter_resources?.some((p) => p.generated) ?? false;
  }, [parameter_resources]);

  // Don't render if show_parameters is false (AFTER all hooks)
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
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <GenericPicker<ParametersItem>
        items={parametersItems}
        itemIds={allParameters
          .map((p) => p.parameter_id)
          .filter((id): id is string => id !== null)} // All parameters IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
