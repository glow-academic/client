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
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface SimulationResourceItem {
  simulation_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface SimulationItem {
  id: string;
  name: string;
  description?: string;
}

export interface SimulationsProps {
  simulation_ids?: string[]; // Current simulation resource IDs (standardized prop name)
  simulation_resources?: SimulationResourceItem[]; // Selected simulation resources (each includes generated field)
  show_simulations?: boolean; // Whether to show this resource picker
  simulations?: SimulationResourceItem[]; // All available simulations from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update simulation_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  searchTerm?: string; // Search term for filtering simulations
  showSelectedFilter?: boolean; // Whether to show only selected simulations
  // Legacy props for backward compatibility
  simulationIds?: string[];
  aiSimulationResources?:
    | Pick<SimulationResourceItem, "simulation_id" | "name">[]
    | null;
}

export function Simulations({
  simulation_ids,
  simulation_resources: _simulation_resources,
  show_simulations = false,
  simulations,
  disabled = false,
  onChange,
  label = "Simulations",
  id = "simulations",
  required = false,
  description,
  group_id: _group_id,
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

  const normalizeDescription = useCallback(
    (description?: string | null) => {
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
    },
    []
  );
  const show = show_simulations ?? false;
  const allSimulations = useMemo(() => simulations ?? [], [simulations]);
  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allSimulations.filter((s) => s.pending && s.simulation_id);
  }, [allSimulations]);
  const pendingIds = useMemo(
    () =>
      new Set(
        pendingItems
          .map((s) => s.simulation_id)
          .filter(Boolean) as string[]
      ),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

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
        };
      });
  }, [allSimulations, normalizeDescription]);

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

  // Check if a simulation is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (simulationId: string) => {
      const sim = allSimulations.find((s) => s.simulation_id === simulationId);
      return sim?.suggested === true;
    },
    [allSimulations]
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

  // Accept pending — keep pending simulations in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending simulations from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

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
          const isPending = showDiff && pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
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

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-tight">
                  {item.name}
                </h3>
                {item.description && (
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
