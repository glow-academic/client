/**
 * Parameters.tsx
 * Resource component for parameters selection
 * Uses GenericPicker to select existing parameters artifacts
 * Manages parameter_ids array and reports to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
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
    parameter_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
    conditional?: boolean | null;
  }>; // Selected parameters resources (each includes generated field)
  show_parameters?: boolean; // Whether to show this resource picker
  parameter_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  parameters?: Array<{
    parameter_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
    conditional?: boolean | null;
    video_parameter?: boolean | null;
    non_video_parameter?: boolean | null;
    scenario_parameter?: boolean | null;
  }>; // All available parameters from API (each includes generated and conditional fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update parameter_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createParametersAction?:
    | ((input: CreateDraftParametersIn) => Promise<CreateDraftParametersOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering parameters
  onSearchChange?: (term: string) => void; // Callback when search term changes
  showSelectedFilter?: boolean; // Whether to show only selected parameters
  onShowSelectedChange?: (value: boolean) => void; // Callback when show selected filter changes
  videoEnabled?: boolean; // Whether video mode is enabled (for filtering)
  // AI diff view props
  aiParameterResources?: Array<{ parameter_id?: string | null; name?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ parameter_id: string | null } | void>) => void;
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
  placeholder: _placeholder = "Select parameters...",
  description,
  group_id,
  link_tool_id,
  showAiGenerate = false,
  createParametersAction,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  onSearchChange,
  showSelectedFilter = false,
  onShowSelectedChange,
  videoEnabled = false,
  // AI diff view props
  aiParameterResources,
  onAccept,
  onReject,
  isAutosaveEnabled = true,
  registerFlush,
}: ParametersProps) {
  const ids = useMemo(() => parameter_ids ?? [], [parameter_ids]);
  const show = show_parameters ?? false;
  const allParameters = useMemo(() => parameters ?? [], [parameters]);

  // Filter parameters based on video mode
  // If scenario_parameter=true, always show (overrides video filtering)
  // Otherwise: video mode ON shows video_parameter=true, video mode OFF shows non_video_parameter=true
  const videoFilteredParameters = useMemo(() => {
    return allParameters.filter((p) => {
      // If scenario_parameter is true, always show (overrides video filtering)
      if (p.scenario_parameter === true) {
        return true;
      }
      const hasVideoFlag = p.video_parameter === true;
      const hasNonVideoFlag = p.non_video_parameter === true;
      // If neither flag is set, always show (backward compatibility)
      if (!hasVideoFlag && !hasNonVideoFlag) {
        return true;
      }
      // If video mode is on, show if video_parameter is true
      if (videoEnabled) {
        return hasVideoFlag;
      }
      // If video mode is off, show if non_video_parameter is true
      return hasNonVideoFlag;
    });
  }, [allParameters, videoEnabled]);
  const suggestionsList = useMemo(
    () => parameter_suggestions ?? [],
    [parameter_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiParameterResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiParameterResources
          ?.map((p) => p.parameter_id)
          .filter(Boolean) as string[]
      ),
    [aiParameterResources]
  );

  // Accept AI suggestion - add AI-suggested parameters to selection
  const handleAccept = useCallback(() => {
    if (!aiParameterResources?.length) return;
    const newIds = aiParameterResources
      .map((p) => p.parameter_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiParameterResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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

  // Track which parameters IDs have already had resources created
  const createdParametersIdsRef = useRef<Set<string>>(new Set());

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ parameter_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ parameter_id: string | null } | void> => {
    // Parameters component uses multi-select - flush creates resources for any uncreated selections
    if (!createParametersAction || !group_id) {
      return;
    }

    const uncreatedIds = ids.filter(id => !createdParametersIdsRef.current.has(id));
    for (const parameterId of uncreatedIds) {
      try {
        await createParametersAction({
          body: {
            group_id: group_id,
            parameter_id: parameterId,
            mcp: false,
          },
        });
        createdParametersIdsRef.current.add(parameterId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create parameters resource for ${parameterId}:`, error);
      }
    }

    // Return the first parameter_id or null
    return { parameter_id: ids.length > 0 ? ids[0] : null };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Initialize createdParametersIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdParametersIdsRef.current.add(id));
  }, [ids]);

  // Convert parameters array to ParametersItem format for GenericPicker
  // Filter out conditional parameters - they are auto-selected via field selection
  const parametersItems = useMemo(() => {
    return videoFilteredParameters
      .filter((p) => p.parameter_id && p.name && !p.conditional) // Filter out nulls and conditional params
      .map((p) => ({
        id: p.parameter_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [videoFilteredParameters]);

  // Filter parameters based on search term and selection
  const filteredParameters = useMemo(() => {
    let filtered = parametersItems;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((parameter) => {
        const searchText =
          `${parameter.name} ${parameter.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    if (showSelectedFilter) {
      filtered = filtered.filter((parameter) => ids.includes(parameter.id));
    }

    return filtered;
  }, [parametersItems, searchTerm, showSelectedFilter, ids]);

  // Check if a parameters is suggested
  const isSuggested = useCallback(
    (parametersId: string) => suggestionsList.includes(parametersId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (parametersId: string) => {
      const isSelected = ids.includes(parametersId);
      let newIds: string[];

      if (isSelected) {
        newIds = ids.filter((id) => id !== parametersId);
      } else {
        newIds = [...ids, parametersId];

        // Only auto-create resources when autosave is enabled
        if (
          isAutosaveEnabled &&
          !createdParametersIdsRef.current.has(parametersId) &&
          createParametersAction &&
          group_id
        ) {
          try {
            await createParametersAction({
              body: {
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

      onChange(newIds);
    },
    [ids, onChange, createParametersAction, group_id, isAutosaveEnabled]
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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
      <SelectableGrid<ParametersItem>
        horizontal
        items={filteredParameters}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

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
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            {/* AI suggested badge - top right */}
            {isAiSuggested && !isSelected && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-xs rounded font-medium">
                AI Suggested
              </div>
            )}

            {isSuggested(item.id) && !isSelected && !isAiSuggested && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                Suggested
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
        }}
        emptyMessage="No parameters found."
        disabled={disabled}
      />
    </div>
  );
}
