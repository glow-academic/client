"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PlayCircle, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SimulationCardGridProps {
  simulationMapping: Record<string, { name: string; description?: string }>;
  validSimulationIds: string[];
  selectedSimulationIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
  canRemoveMap?: Record<string, boolean>; // Map of simulation ID to can_remove
  hideSearch?: boolean; // Hide the built-in search bar (for use with StepCard search)
  externalSearchTerm?: string; // External search term when hideSearch is true
}

export function SimulationCardGrid({
  simulationMapping,
  validSimulationIds,
  selectedSimulationIds,
  onSelect,
  readonly = false,
  canRemoveMap = {},
  hideSearch = false,
  externalSearchTerm = "",
}: SimulationCardGridProps) {
  const [internalSearchTerm, setInternalSearchTerm] = React.useState("");
  const searchTerm = hideSearch ? externalSearchTerm : internalSearchTerm;

  // Build simulations from mapping
  const baseSimulations = React.useMemo(() => {
    const simulations = validSimulationIds.map((id) => ({
      id,
      ...simulationMapping[id],
    }));

    // Sort by name
    return simulations.sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [validSimulationIds, simulationMapping]);

  // Apply search filter, then sort selected first
  const filteredSimulations = React.useMemo(() => {
    let filtered = baseSimulations;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (simulation) =>
          simulation.name?.toLowerCase().includes(searchLower) ||
          simulation.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected simulations first (preserving order from selectedSimulationIds array), then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedSimulationIds.includes(a.id);
      const bSelected = selectedSimulationIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from selectedSimulationIds array
        const aIndex = selectedSimulationIds.indexOf(a.id);
        const bIndex = selectedSimulationIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseSimulations, searchTerm, selectedSimulationIds]);

  const handleSelect = (simulationId: string) => {
    if (readonly) return;
    const isSelected = selectedSimulationIds.includes(simulationId);
    // Prevent unselection if can_remove is false
    if (isSelected && canRemoveMap[simulationId] === false) {
      return;
    }
    const newIds = isSelected
      ? selectedSimulationIds.filter((id) => id !== simulationId)
      : [...selectedSimulationIds, simulationId];
    onSelect(newIds);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar - only show if not hidden */}
        {!hideSearch && (
          <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
            <Search className="size-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder="Search simulations..."
              value={internalSearchTerm}
              onChange={(e) => setInternalSearchTerm(e.target.value)}
              className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={readonly}
            />
          </div>
        )}

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredSimulations.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No simulations found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredSimulations.map((simulation) => {
              const isSelected = selectedSimulationIds.includes(simulation.id);
              const cannotRemove =
                isSelected && canRemoveMap[simulation.id] === false;

              return (
                <Tooltip key={simulation.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(simulation.id)}
                      disabled={readonly || cannotRemove}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent",
                        cannotRemove && "opacity-75 cursor-not-allowed",
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <PlayCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {simulation.name || "Unnamed Simulation"}
                          </h3>
                          {simulation.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {simulation.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  {cannotRemove && (
                    <TooltipContent>
                      <p>
                        This simulation cannot be removed because it has active
                        records
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
