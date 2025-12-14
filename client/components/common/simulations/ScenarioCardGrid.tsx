"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type SimulationsListOut = OutputOf<"/api/v3/simulations/list", "post">;
type ScenarioMappingItem = SimulationsListOut["scenario_mapping"][string];


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
}

export function ScenarioCardGrid<
  T extends ScenarioMappingItem = ScenarioMappingItem,
>({
  scenarioMapping,
  validScenarioIds,
  selectedScenarioIds,
  onSelect,
  label = "Scenarios",
  description = "Select scenarios to add to the simulation",
  readonly = false,
}: ScenarioCardGridProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build scenarios from mapping
  const baseScenarios = React.useMemo(() => {
    const scenarios = validScenarioIds.map((id) => ({
      id,
      ...scenarioMapping[id],
    }));

    // Sort by name
    return scenarios.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validScenarioIds, scenarioMapping]);


  // Apply search filter, then sort selected first
  const filteredScenarios = React.useMemo(() => {
    let filtered = baseScenarios;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (scenario) =>
          scenario.name?.toLowerCase().includes(searchLower) ||
          scenario.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected scenarios first, then by name
    return filtered.sort((a, b) => {
      const aSelected = selectedScenarioIds.includes(a.id);
      const bSelected = selectedScenarioIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseScenarios, searchTerm, selectedScenarioIds]);

  const handleSelect = (scenarioId: string) => {
    if (readonly) return;
    const isSelected = selectedScenarioIds.includes(scenarioId);
    const newIds = isSelected
      ? selectedScenarioIds.filter((id) => id !== scenarioId)
      : [...selectedScenarioIds, scenarioId];
    onSelect(newIds);
  };

  // Helper to render parameter badges
  const getScenarioParameterBadges = (scenario: { id: string } & T) => {
    if (
      !scenario.parameter_item_ids ||
      scenario.parameter_item_ids.length === 0
    ) {
      return [];
    }
    const badges: {
      parameterName: string;
      value: string;
      parameterId: string;
    }[] = [];
    scenario.parameter_item_ids.forEach((parameterItemId) => {
      const parameterItem = scenario.parameter_item_mapping?.[parameterItemId] as {
        parameter_name?: string;
        name?: string;
        parameter_id?: string;
      } | undefined;
      if (
        parameterItem &&
        parameterItem.parameter_name &&
        parameterItem.name &&
        parameterItem.parameter_id
      ) {
        badges.push({
          parameterName: parameterItem.parameter_name,
          value: parameterItem.name,
          parameterId: parameterItem.parameter_id,
        });
      }
    });
    return badges;
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
              const badges = getScenarioParameterBadges(scenario);

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelect(scenario.id)}
                  disabled={readonly}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent"
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
                        {scenario.name || "Unnamed Scenario"}
                      </h3>
                      {scenario.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {badges.slice(0, 3).map((badge, idx) => (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              {badge.value}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{badge.parameterName}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {badges.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{badges.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

