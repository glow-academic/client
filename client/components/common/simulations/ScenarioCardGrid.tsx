"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileText, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type SimulationsListOut = OutputOf<"/api/v4/artifacts/simulations/list", "post">;
type ScenarioMappingItem = SimulationsListOut extends { scenario_mapping: Record<string, infer T> }
  ? T
  : { id: string; name?: string; description?: string };

export interface ScenarioCardGridProps<
  T extends ScenarioMappingItem = ScenarioMappingItem,
> {
  scenarioMapping: Record<string, T>;
  validScenarioIds: string[];
  selectedScenarioIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
  canRemoveMap?: Record<string, boolean>; // Map of scenario ID to can_remove
}

export function ScenarioCardGrid<
  T extends ScenarioMappingItem = ScenarioMappingItem,
>({
  scenarioMapping,
  validScenarioIds,
  selectedScenarioIds,
  onSelect,
  readonly = false,
  canRemoveMap = {},
}: ScenarioCardGridProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build scenarios from mapping
  const baseScenarios = React.useMemo(() => {
    const scenarios = validScenarioIds
      .map((id) => {
        const mappingItem = scenarioMapping[id];
        if (!mappingItem) return null;
        return {
          ...mappingItem,
          id, // Ensure id matches the key
        } as { id: string } & T;
      })
      .filter((scenario): scenario is { id: string } & T => scenario !== null);

    // Sort by name
    return scenarios.sort((a, b) => {
      const aName = (a as { name?: string }).name || "";
      const bName = (b as { name?: string }).name || "";
      return aName.localeCompare(bName);
    });
  }, [validScenarioIds, scenarioMapping]);

  // Apply search filter, then sort selected first
  const filteredScenarios = React.useMemo(() => {
    let filtered = baseScenarios;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((scenario) => {
        const name = (scenario as { name?: string }).name || "";
        const description = (scenario as { description?: string }).description || "";
        return (
          name.toLowerCase().includes(searchLower) ||
          description.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort: selected scenarios first (preserving order from selectedScenarioIds array), then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedScenarioIds.includes(a.id);
      const bSelected = selectedScenarioIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from selectedScenarioIds array
        const aIndex = selectedScenarioIds.indexOf(a.id);
        const bIndex = selectedScenarioIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      const aName = (a as { name?: string }).name || "";
      const bName = (b as { name?: string }).name || "";
      return aName.localeCompare(bName);
    });
  }, [baseScenarios, searchTerm, selectedScenarioIds]);

  const handleSelect = (scenarioId: string) => {
    if (readonly) return;
    const isSelected = selectedScenarioIds.includes(scenarioId);
    // Prevent unselection if can_remove is false
    if (isSelected && canRemoveMap[scenarioId] === false) {
      return;
    }
    const newIds = isSelected
      ? selectedScenarioIds.filter((id) => id !== scenarioId)
      : [...selectedScenarioIds, scenarioId];
    onSelect(newIds);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search scenarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredScenarios.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No scenarios found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredScenarios.map((scenario) => {
              const isSelected = selectedScenarioIds.includes(scenario.id);
              const cannotRemove =
                isSelected && canRemoveMap[scenario.id] === false;

              return (
                <Tooltip key={scenario.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(scenario.id)}
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
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {("name" in scenario ? scenario.name : null) || "Unnamed Scenario"}
                          </h3>
                          {("description" in scenario ? scenario.description : null) && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {"description" in scenario ? scenario.description : null}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  {cannotRemove && (
                    <TooltipContent>
                      <p>
                        This scenario cannot be removed because it has active
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
