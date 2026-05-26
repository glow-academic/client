/**
 * Scenarios.tsx
 * Resource component for scenario selection
 * Uses SelectableGrid to display scenarios as horizontal scrollable cards
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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ScenarioResourceItem {
  scenario_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ScenarioItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenariosProps {
  scenario_ids?: string[]; // Current scenario resource IDs (standardized prop name)
  scenario_resources?: ScenarioResourceItem[]; // Selected scenario resources (each includes generated field)
  show_scenarios?: boolean; // Whether to show this resource picker
  scenarios?: ScenarioResourceItem[]; // All available scenarios from API (each includes generated, suggested, pending fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  showSelectedOnly?: boolean;
  aiScenarioResources?: Array<
    Pick<ScenarioResourceItem, "scenario_id" | "name">
  > | null;
  /** Per-field pending lifecycle (multi-select). See ParameterFields.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

export function Scenarios({
  scenario_ids,
  scenario_resources: _scenario_resources,
  show_scenarios = false,
  scenarios,
  disabled = false,
  onChange,
  label = "Scenarios",
  id = "scenarios",
  required = false,
  placeholder = "Select scenarios...",
  description,
  searchTerm,
  showSelectedOnly = false,
  onAcceptPending,
  onRejectPending,
}: ScenariosProps) {
  const ids = useMemo(() => scenario_ids ?? [], [scenario_ids]);
  const show = show_scenarios ?? false;
  const allScenarios = useMemo(() => scenarios ?? [], [scenarios]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allScenarios.filter((s) => s.pending && s.scenario_id);
  }, [allScenarios]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((s) => s.scenario_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert scenarios array to ScenarioItem format for SelectableGrid
  const scenarioItems = useMemo(() => {
    return allScenarios
      .filter((s) => s.scenario_id && s.name)
      .map((s) => ({
        id: s.scenario_id!,
        name: s.name!,
        ...(s.description ? { description: s.description } : {}),
      }));
  }, [allScenarios]);

  // Check if a scenario is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (scenarioId: string) => {
      const scenario = allScenarios.find((s) => s.scenario_id === scenarioId);
      return scenario?.suggested === true;
    },
    [allScenarios]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
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

  // Accept pending — keep pending scenarios in selection.
  // Parent hook (if provided) strips them from ``pending_ids``.
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
  }, [onAcceptPending, pendingIds]);

  // Reject pending — remove pending scenarios from selection
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
      return;
    }
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange, onRejectPending]);

  // Don't render if show_scenarios is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="picker-scenarios">
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
          const isPending = showDiff && pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative rounded-lg border bg-card p-3 text-left text-card-foreground shadow-sm transition-all",
                "hover:border-primary hover:shadow-md focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {/* Suggested dot indicator - top right */}
              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
              : (placeholder ?? "No scenarios available.")
        }
        disabled={disabled}
        className="pt-2"
        maxHeight="max-h-[272px]"
      />
    </div>
  );
}
