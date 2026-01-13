/**
 * ScenarioFlags.tsx
 * Resource component for simulation scenario flag selection
 * Uses GenericPicker to select existing simulation scenario flag resources
 * Manages scenario_flag_ids array and reports to parent
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

type CreateDraftSimulationScenarioFlagsIn = InputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;
type CreateDraftSimulationScenarioFlagsOut = OutputOf<
  "/api/v4/resources/simulation_scenario_flags",
  "post"
>;

export interface ScenarioFlagItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenarioFlagsProps {
  scenario_flag_ids?: string[]; // Current scenario flag resource IDs (standardized prop name)
  scenario_flag_resources?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
    icon_id?: string | null;
    generated?: boolean | null;
  }>; // Selected scenario flag resources (each includes generated field)
  show_scenario_flags?: boolean; // Whether to show this resource picker
  scenario_flag_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenario_flags?: Array<{
    id: string | null;
    name: string | null;
    description?: string | null;
    icon_id?: string | null;
    generated?: boolean | null;
  }>; // All available scenario flags from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_flag_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenarioFlagsAction?:
    | ((
        input: CreateDraftSimulationScenarioFlagsIn
      ) => Promise<CreateDraftSimulationScenarioFlagsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ScenarioFlags({
  scenario_flag_ids,
  scenario_flag_resources,
  show_scenario_flags = false,
  scenario_flag_suggestions,
  scenario_flags,
  disabled = false,
  onChange,
  label = "Scenario Flags",
  id = "scenario_flags",
  required = false,
  placeholder = "Select scenario flags...",
  description,
  group_id,
  agent_id,
  createScenarioFlagsAction,
  onGenerate,
  isGenerating = false,
}: ScenarioFlagsProps) {
  const ids = useMemo(() => scenario_flag_ids ?? [], [scenario_flag_ids]);
  const show = show_scenario_flags ?? false;
  const allScenarioFlags = useMemo(() => scenario_flags ?? [], [scenario_flags]);
  const suggestionsList = useMemo(
    () => scenario_flag_suggestions ?? [],
    [scenario_flag_suggestions]
  );

  // Track which scenario flag IDs have already had resources created
  const createdScenarioFlagIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdScenarioFlagIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdScenarioFlagIdsRef.current.add(id));
  }, [ids]);

  // Convert scenario flags array to ScenarioFlagItem format for GenericPicker
  const scenarioFlagItems = useMemo(() => {
    return allScenarioFlags
      .filter((f) => f.id && f.name) // Filter out nulls
      .map((f) => ({
        id: f.id!,
        name: f.name!,
        ...(f.description ? { description: f.description } : {}), // Only include if not null/undefined
      }));
  }, [allScenarioFlags]);

  // Check if a scenario flag is suggested
  const isSuggested = useCallback(
    (scenarioFlagId: string) => suggestionsList.includes(scenarioFlagId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdScenarioFlagIdsRef.current.has(id)
      );

      // Create resources for newly selected scenario flags
      if (
        newlySelected.length > 0 &&
        createScenarioFlagsAction &&
        agent_id &&
        group_id
      ) {
        for (const scenarioFlagId of newlySelected) {
          try {
            // Find the scenario flag resource to get name/description
            const scenarioFlagResource = allScenarioFlags.find(
              (f) => f.id === scenarioFlagId
            );
            if (scenarioFlagResource?.name) {
              await createScenarioFlagsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  name: scenarioFlagResource.name,
                  description: scenarioFlagResource.description || "",
                  icon_id: scenarioFlagResource.icon_id || null,
                  mcp: false,
                },
              });
              createdScenarioFlagIdsRef.current.add(scenarioFlagId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create scenario flag resource for ${scenarioFlagId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [
      ids,
      onChange,
      createScenarioFlagsAction,
      agent_id,
      group_id,
      allScenarioFlags,
    ]
  );

  // Check if any scenario flag resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return scenario_flag_resources?.some((f) => f.generated) ?? false;
  }, [scenario_flag_resources]);

  // Don't render if show_scenario_flags is false (AFTER all hooks)
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
      <GenericPicker<ScenarioFlagItem>
        items={scenarioFlagItems}
        itemIds={allScenarioFlags
          .map((f) => f.id)
          .filter((id): id is string => id !== null)} // All scenario flag IDs from array, filter nulls
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
