/**
 * Simulations.tsx
 * Resource component for simulation selection
 * Uses GenericPicker to select existing simulation resources
 * Manages simulation_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface SimulationItem {
  id: string;
  name: string;
  description?: string;
  time_limit?: number | null;
}

export interface SimulationsProps {
  simulation_ids?: string[]; // Current simulation resource IDs (standardized prop name)
  simulation_resources?: Array<{
    simulation_id: string | null;
    name: string | null;
    description?: string | null;
    time_limit?: number | null;
    generated?: boolean | null;
  }>; // Selected simulation resources (each includes generated field)
  show_simulations?: boolean; // Whether to show this resource picker
  simulation_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  simulations?: Array<{
    simulation_id: string | null;
    name: string | null;
    description?: string | null;
    time_limit?: number | null;
    generated?: boolean | null;
  }>; // All available simulations from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update simulation_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation (not used for simulations, but kept for consistency)
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering simulations
  showSelectedFilter?: boolean; // Whether to show only selected simulations
  // Legacy props for backward compatibility
  simulationIds?: string[];
}

export function Simulations({
  simulation_ids,
  simulation_resources,
  show_simulations = false,
  simulation_suggestions,
  simulations,
  disabled = false,
  onChange,
  label = "Simulations",
  id = "simulations",
  required = false,
  placeholder = "Select simulations...",
  description,
  group_id,
  agent_id,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
  // Legacy props for backward compatibility
  simulationIds,
}: SimulationsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => simulation_ids ?? simulationIds ?? [],
    [simulation_ids, simulationIds]
  );
  const show = show_simulations ?? false;
  const allSimulations = useMemo(() => simulations ?? [], [simulations]);
  const suggestionsList = useMemo(
    () => simulation_suggestions ?? [],
    [simulation_suggestions]
  );

  // Convert simulations array to SimulationItem format for GenericPicker
  const simulationItems = useMemo(() => {
    return allSimulations
      .filter((s) => s.simulation_id && s.name) // Filter out nulls
      .map((s) => ({
        id: s.simulation_id!,
        name: s.name!,
        ...(s.description ? { description: s.description } : {}), // Only include if not null/undefined
        ...(s.time_limit !== null && s.time_limit !== undefined
          ? { time_limit: s.time_limit }
          : {}),
      }));
  }, [allSimulations]);

  // Filter simulations based on search term and show selected filter
  const filteredSimulationItems = useMemo(() => {
    let filtered = simulationItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((sim) => {
        const searchText =
          `${sim.name} ${sim.description || ""}`.toLowerCase();
        return searchText.includes(searchLower);
      });
    }

    // Apply show selected filter
    if (showSelectedFilter) {
      filtered = filtered.filter((sim) => ids.includes(sim.id));
    }

    return filtered;
  }, [simulationItems, searchTerm, showSelectedFilter, ids]);

  // Check if a simulation is suggested
  const isSuggested = useCallback(
    (simulationId: string) => suggestionsList.includes(simulationId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state (simulations don't need resource creation)
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any simulation resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return simulation_resources?.some((s) => s.generated) ?? false;
  }, [simulation_resources]);

  // Format time limit for display
  const formatTimeLimit = useCallback((seconds: number | null | undefined) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // Don't render if show_simulations is false (AFTER all hooks)
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
      <GenericPicker<SimulationItem>
        items={filteredSimulationItems}
        itemIds={allSimulations
          .map((s) => s.simulation_id)
          .filter((id): id is string => id !== null)} // All simulation IDs from array, filter nulls
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.description && (
                    <span className="truncate">{item.description}</span>
                  )}
                  {item.time_limit && (
                    <span className="shrink-0">
                      {formatTimeLimit(item.time_limit)}
                    </span>
                  )}
                </div>
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
