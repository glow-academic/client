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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftScenariosIn = InputOf<"/api/v4/resources/scenarios", "post">;
type CreateDraftScenariosOut = OutputOf<"/api/v4/resources/scenarios", "post">;

// Derive resource item type from the GET endpoint response
type ScenariosGetResponse = OutputOf<"/api/v4/resources/scenarios/get", "post">;
export type ScenarioResourceItem = NonNullable<ScenariosGetResponse["items"]>[number];

export interface ScenarioItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenariosProps {
  scenario_ids?: string[]; // Current scenario resource IDs (standardized prop name)
  scenario_resources?: ScenarioResourceItem[]; // Selected scenario resources (each includes generated field)
  show_scenarios?: boolean; // Whether to show this resource picker
  scenario_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenarios?: ScenarioResourceItem[]; // All available scenarios from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  showSelectedOnly?: boolean;
  // AI diff view props
  aiScenarioResources?: Array<Pick<ScenarioResourceItem, "scenario_id" | "name">> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  onGenerate,
  showAiGenerate = false,
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

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "scenarios",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((s) => s.scenario_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
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
      .filter((s) => s.scenario_id && s.name)
      .map((s) => ({
        id: s.scenario_id!,
        name: s.name!,
        ...(s.description ? { description: s.description } : {}),
      }));
  }, [allScenarios]);

  // Check if a scenario is suggested
  const isSuggested = useCallback(
    (scenarioId: string) => suggestionsList.includes(scenarioId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
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

  // Accept AI suggestion - add AI-suggested scenarios to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((s) => s.scenario_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

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
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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
      <SelectableGrid<ScenarioItem>
        horizontal
        items={filteredScenarioItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleGridSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative rounded-lg border bg-card p-3 text-left text-card-foreground shadow-sm transition-all",
                "hover:border-primary hover:shadow-md focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "border-transparent ring-2 ring-primary bg-primary/5"
                  : "border-input",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {/* AI Suggested badge - top right */}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              {/* Suggested badge - top right */}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {item.name}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage={
          normalizedSearch
            ? `No scenarios match "${searchTerm?.trim()}".`
            : showSelectedOnly && ids.length === 0
            ? "No scenarios selected."
            : placeholder ?? "No scenarios available."
        }
        disabled={disabled}
        className="pt-2"
        maxHeight="max-h-[272px]"
      />
    </div>
  );
}
