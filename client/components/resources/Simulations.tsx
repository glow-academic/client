/**
 * Simulations.tsx
 * Resource component for simulation selection
 * Uses SelectableGrid for grid card layout (like Fields.tsx)
 * Manages simulation_ids array and reports to parent
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
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
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  searchTerm?: string; // Search term for filtering simulations
  showSelectedFilter?: boolean; // Whether to show only selected simulations
  // Legacy props for backward compatibility
  simulationIds?: string[];
  // AI diff view props
  aiSimulationResources?: Array<{
    simulation_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  link_tool_id,
  onGenerate,
  isGenerating = false,
  searchTerm = "",
  showSelectedFilter = false,
  // Legacy props for backward compatibility
  simulationIds,
  // AI diff view props
  aiSimulationResources,
  onAccept,
  onReject,
}: SimulationsProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => simulation_ids ?? simulationIds ?? [],
    [simulation_ids, simulationIds]
  );

  const normalizeDescription = useCallback((description?: string | null) => {
    const trimmed = description?.trim() || "";
    if (!trimmed) return null;
    if (trimmed === "0") return null;
    if (/^\d+$/.test(trimmed)) return null;
    const trailingZeroMatch = trimmed.match(/^(.*)\s0$/);
    if (trailingZeroMatch && !/\d/.test(trailingZeroMatch[1])) {
      const withoutTrailingZero = trailingZeroMatch[1].trim();
      return withoutTrailingZero || null;
    }
    return trimmed;
  }, []);
  const show = show_simulations ?? false;
  const allSimulations = useMemo(() => simulations ?? [], [simulations]);
  const suggestionsList = useMemo(
    () => simulation_suggestions ?? [],
    [simulation_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiSimulationResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSimulationResources
          ?.map((s) => s.simulation_id)
          .filter(Boolean) as string[]
      ),
    [aiSimulationResources]
  );

  // Convert simulations array to SimulationItem format for SelectableGrid
  const simulationItems = useMemo(() => {
    return allSimulations
      .filter((s) => s.simulation_id && s.name) // Filter out nulls
      .map((s) => {
        const normalizedDescription = normalizeDescription(s.description);
        return {
          id: s.simulation_id!,
          name: s.name!,
          ...(normalizedDescription
            ? { description: normalizedDescription }
            : {}),
          ...(s.time_limit !== null && s.time_limit !== undefined
            ? { time_limit: s.time_limit }
            : {}),
        };
      });
  }, [allSimulations]);

  // Filter simulations based on search term and show selected filter
  const filteredSimulationItems = useMemo(() => {
    let filtered = simulationItems;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((sim) => {
        const searchText = `${sim.name} ${sim.description || ""}`.toLowerCase();
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
    (simulationId: string) => {
      const isSelected = ids.includes(simulationId);
      const newIds = isSelected
        ? ids.filter((id) => id !== simulationId)
        : [...ids, simulationId];

      onChange(newIds);
    },
    [ids, onChange]
  );

  // Check if any simulation resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return simulation_resources?.some((s) => s.generated) ?? false;
  }, [simulation_resources]);

  // Accept AI suggestion - add AI-suggested simulations to selection
  const handleAccept = useCallback(() => {
    if (!aiSimulationResources?.length) return;
    const newIds = aiSimulationResources
      .map((s) => s.simulation_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiSimulationResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && link_tool_id && (
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
      <SelectableGrid<SimulationItem>
        horizontal
        items={filteredSimulationItems}
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
              {/* Check icon - top right */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
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
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  Suggested
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
                {(item.description || item.time_limit) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {item.description && (
                      <p className="truncate">{item.description}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No simulations found."
        disabled={disabled}
      />
    </div>
  );
}
