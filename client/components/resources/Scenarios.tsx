/**
 * Scenarios.tsx
 * Resource component for scenario selection
 * Uses GenericPicker to select existing scenario resources
 * Manages scenario_ids array and reports to parent
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
  searchTerm?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenariosAction?:
    | ((input: CreateDraftScenariosIn) => Promise<CreateDraftScenariosOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showSelectedOnly?: boolean;
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
  searchTerm,
  showSelectedOnly = false,
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

  const handleGridSelect = useCallback(
    (scenarioId: string) => {
      const alreadySelected = ids.includes(scenarioId);
      const nextSelectedIds = alreadySelected
        ? ids.filter((id) => id !== scenarioId)
        : [...ids, scenarioId];
      void handleSelect(nextSelectedIds);
    },
    [ids, handleSelect]
  );

  const normalizedSearch = useMemo(
    () => (searchTerm ?? "").trim().toLowerCase(),
    [searchTerm]
  );

  const filteredScenarioItems = useMemo(() => {
    let items = scenarioItems;
    if (showSelectedOnly) {
      items = items.filter((item) => ids.includes(item.id));
    }

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => {
      const name = item.name.toLowerCase();
      const description = item.description?.toLowerCase() ?? "";
      return (
        name.includes(normalizedSearch) ||
        description.includes(normalizedSearch)
      );
    });
  }, [ids, normalizedSearch, scenarioItems, showSelectedOnly]);

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
      <SelectableGrid<ScenarioItem>
        items={filteredScenarioItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleGridSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative min-h-[110px] rounded-xl border bg-card p-4 text-left text-card-foreground shadow-sm transition-all",
              "hover:border-primary hover:shadow-md focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-transparent ring-2 ring-primary bg-primary/5"
                : "border-input"
            )}
          >
            {isSuggested(item.id) && !isSelected && (
              <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Suggested
              </span>
            )}
            {isSelected && (
              <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="space-y-1">
              <div className="text-sm font-semibold uppercase tracking-wide text-primary">
                {item.name}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )}
        emptyMessage={
          normalizedSearch
            ? `No scenarios match "${searchTerm?.trim()}".`
            : showSelectedOnly && ids.length === 0
            ? "No scenarios selected."
            : placeholder ?? "No scenarios available."
        }
        disabled={disabled}
        className="pt-2"
        maxHeight="max-h-[520px]"
      />
    </div>
  );
}
