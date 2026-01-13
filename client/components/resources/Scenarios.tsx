/**
 * Scenarios.tsx
 * Resource component for scenario selection
 * Uses GenericPicker to select existing scenario resources
 * Manages scenario_ids array and reports to parent
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

type CreateDraftScenariosIn = InputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftScenariosOut = OutputOf<"/api/v4/resources/scenarios", "post">;

export interface ScenarioItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenariosProps {
  scenario_ids?: string[]; // Current scenario resource IDs (standardized prop name)
  scenario_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected scenario resources (each includes generated field)
  show_scenarios?: boolean; // Whether to show this resource picker
  scenario_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenarios?: Array<{
    id: string | null;
    scenario_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available scenarios from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenariosAction?:
    | ((input: CreateDraftScenariosIn) => Promise<CreateDraftScenariosOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Scenarios({
  scenario_ids,
  scenario_resources,
  show_scenarios = false,
  scenario_suggestions,
  scenarios,
  disabled = false,
  onChange,
  label = "Scenarios",
  id = "scenarios",
  required = false,
  placeholder = "Select scenarios...",
  description,
  group_id,
  agent_id,
  createScenariosAction,
  onGenerate,
  isGenerating = false,
}: ScenariosProps) {
  const ids = useMemo(() => scenario_ids ?? [], [scenario_ids]);
  const show = show_scenarios ?? false;
  const allScenarios = useMemo(() => scenarios ?? [], [scenarios]);
  const suggestionsList = useMemo(
    () => scenario_suggestions ?? [],
    [scenario_suggestions]
  );

  // Track which scenario IDs have already had resources created
  const createdScenarioIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdScenarioIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdScenarioIdsRef.current.add(id));
  }, [ids]);

  // Convert scenarios array to ScenarioItem format for GenericPicker
  const scenarioItems = useMemo(() => {
    return allScenarios
      .filter((s) => s.id && s.name) // Filter out nulls
      .map((s) => ({
        id: s.id!,
        name: s.name!,
        ...(s.description ? { description: s.description } : {}), // Only include if not null/undefined
      }));
  }, [allScenarios]);

  // Check if a scenario is suggested
  const isSuggested = useCallback(
    (scenarioId: string) => suggestionsList.includes(scenarioId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdScenarioIdsRef.current.has(id)
      );

      // Create resources for newly selected scenarios
      if (
        newlySelected.length > 0 &&
        createScenariosAction &&
        agent_id &&
        group_id
      ) {
        for (const scenarioResourceId of newlySelected) {
          try {
            // Find the scenario artifact ID from the resource
            const scenarioResource = allScenarios.find(
              (s) => s.id === scenarioResourceId
            );
            if (scenarioResource?.scenario_id) {
              await createScenariosAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  scenario_id: scenarioResource.scenario_id,
                  mcp: false,
                },
              });
              createdScenarioIdsRef.current.add(scenarioResourceId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create scenario resource for ${scenarioResourceId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createScenariosAction, agent_id, group_id, allScenarios]
  );

  // Check if any scenario resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return scenario_resources?.some((s) => s.generated) ?? false;
  }, [scenario_resources]);

  // Don't render if show_scenarios is false (AFTER all hooks)
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
      <GenericPicker<ScenarioItem>
        items={scenarioItems}
        itemIds={allScenarios
          .map((s) => s.id)
          .filter((id): id is string => id !== null)} // All scenario IDs from array, filter nulls
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
