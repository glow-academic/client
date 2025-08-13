/**
 * SimulationPicker.tsx
 * Used to pick simulations for filtering or assignment to cohorts
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Filter, Play, X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";
import { Parameter, ParameterItem } from "@/types";

export interface Simulation {
  id: string;
  title: string | React.ReactNode;
  description?: string;
  timeLimit?: number | undefined;
  active: boolean;
  defaultSimulation?: boolean;
  practiceSimulation?: boolean;
  scenarioIds?: string[];
  updatedAt?: string;
}

export interface SimulationPickerProps extends PopoverProps {
  simulations: Simulation[];
  scenarios?: {
    id: string;
    parameterItemIds?: string[] | null;
    personaId?: string | null;
  }[];
  parameters?: Parameter[];
  parameterItems?: ParameterItem[];
  personas?: { id: string; name: string }[];
  label?: string;
  placeholder?: string;
  description?: string;
  onSelect?: (simulations: Simulation[]) => void;
  selectedSimulations?: Simulation[];
  hideSelectedChips?: boolean;
  showOnlyActive?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
}

export function SimulationPicker({
  simulations,
  scenarios = [],
  parameters = [],
  parameterItems = [],
  personas = [],
  label = "Simulations",
  placeholder = "Select simulations...",
  description = "Select one or more simulations to assign to the cohort.",
  onSelect,
  selectedSimulations = [],
  hideSelectedChips = true,
  showOnlyActive = true,
  showLabel = true,
  buttonClassName,
  ...props
}: SimulationPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedSimulation, setPeekedSimulation] = React.useState<
    Simulation | undefined
  >(simulations[0]);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterPersonaIds, setFilterPersonaIds] = React.useState<string[]>([]);
  const [filterParameterItemIds, setFilterParameterItemIds] = React.useState<
    string[]
  >([]);

  // Filter simulations to show only active ones if requested, and exclude practice simulations
  const baseSimulations = (
    showOnlyActive ? simulations.filter((sim) => sim.active) : simulations
  ).filter((sim) => !sim.practiceSimulation);

  // Build lookup maps for scenarios, personaIds, and parameter items per simulation
  const scenarioById = React.useMemo(() => {
    const map = new Map<string, (typeof scenarios)[number]>();
    scenarios.forEach((s) => map.set(s.id, s));
    return map;
  }, [scenarios]);

  const simulationToPersonaIds = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    baseSimulations.forEach((sim) => {
      const set = new Set<string>();
      (sim.scenarioIds || []).forEach((sid) => {
        const sc = scenarioById.get(sid);
        if (sc?.personaId) set.add(sc.personaId);
      });
      map.set(sim.id, set);
    });
    return map;
  }, [baseSimulations, scenarioById]);

  const simulationToParameterItemIds = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    baseSimulations.forEach((sim) => {
      const set = new Set<string>();
      (sim.scenarioIds || []).forEach((sid) => {
        const sc = scenarioById.get(sid);
        (sc?.parameterItemIds || []).forEach((pid) => set.add(pid));
      });
      map.set(sim.id, set);
    });
    return map;
  }, [baseSimulations, scenarioById]);

  // Known persona options with frequency across all simulations
  const personaOptions = React.useMemo(() => {
    const countMap = new Map<string, number>();
    baseSimulations.forEach((sim) => {
      const ids = simulationToPersonaIds.get(sim.id) || new Set<string>();
      ids.forEach((id) => countMap.set(id, (countMap.get(id) || 0) + 1));
    });
    const byId = new Map(personas.map((p) => [p.id, p.name] as const));
    const rows = Array.from(countMap.entries())
      .filter(([id]) => byId.has(id))
      .map(([id, count]) => ({ id, name: byId.get(id)!, count }));
    rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return rows;
  }, [baseSimulations, simulationToPersonaIds, personas]);

  // Known parameter item options with frequency across all simulations
  const parameterItemOptions = React.useMemo(() => {
    const itemById = new Map(parameterItems.map((i) => [i.id, i] as const));
    const paramById = new Map(parameters.map((p) => [p.id, p] as const));
    const countMap = new Map<string, number>();
    baseSimulations.forEach((sim) => {
      const ids = simulationToParameterItemIds.get(sim.id) || new Set<string>();
      ids.forEach((id) => countMap.set(id, (countMap.get(id) || 0) + 1));
    });
    const rows = Array.from(countMap.entries())
      .filter(([id]) => itemById.has(id))
      .map(([id, count]) => {
        const item = itemById.get(id)!;
        const param = paramById.get(item.parameterId);
        const label = param ? `${param.name}: ${item.value}` : item.value;
        return { id, label, count };
      });
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return rows;
  }, [
    baseSimulations,
    simulationToParameterItemIds,
    parameterItems,
    parameters,
  ]);

  // Apply filters
  const filteredSimulations = React.useMemo(() => {
    return baseSimulations.filter((sim) => {
      const personaIds =
        simulationToPersonaIds.get(sim.id) || new Set<string>();
      const paramIds =
        simulationToParameterItemIds.get(sim.id) || new Set<string>();

      // Personas: any-of
      if (
        filterPersonaIds.length > 0 &&
        !filterPersonaIds.some((pid) => personaIds.has(pid))
      ) {
        return false;
      }

      // Parameter items: all-of
      if (
        filterParameterItemIds.length > 0 &&
        !filterParameterItemIds.every((pid) => paramIds.has(pid))
      ) {
        return false;
      }

      return true;
    });
  }, [
    baseSimulations,
    simulationToPersonaIds,
    simulationToParameterItemIds,
    filterPersonaIds,
    filterParameterItemIds,
  ]);

  // Sort by updatedAt desc by default
  const sortedFilteredSimulations = React.useMemo(() => {
    return [...filteredSimulations].sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bd !== ad) return bd - ad;
      const at = typeof a.title === "string" ? a.title : "";
      const bt = typeof b.title === "string" ? b.title : "";
      return at.localeCompare(bt);
    });
  }, [filteredSimulations]);

  // Get scenario badges for a simulation (aggregated from all scenarios)
  const getSimulationScenarioBadges = (simulation: Simulation) => {
    if (!simulation.scenarioIds || simulation.scenarioIds.length === 0) {
      return [];
    }

    // Collect all parameter items from all scenarios in this simulation with frequency tracking
    const parameterFrequency = new Map<
      string,
      {
        parameterName: string;
        value: string;
        parameterId: string;
        count: number;
      }
    >();

    simulation.scenarioIds.forEach((scenarioId) => {
      const scenario = scenarios.find((s) => s.id === scenarioId);
      if (scenario?.parameterItemIds) {
        scenario.parameterItemIds.forEach((parameterItemId: string) => {
          const parameterItem = parameterItems.find(
            (item) => item.id === parameterItemId
          );
          if (parameterItem) {
            const parameter = parameters.find(
              (param) => param.id === parameterItem.parameterId
            );
            if (parameter && !parameter.numerical) {
              // Use parameter name as key to avoid duplicates
              const key = parameter.name;
              const existing = parameterFrequency.get(key);
              if (existing) {
                existing.count += 1;
              } else {
                parameterFrequency.set(key, {
                  parameterName: parameter.name,
                  value: parameterItem.value,
                  parameterId: parameter.id,
                  count: 1,
                });
              }
            }
          }
        });
      }
    });

    // Sort by frequency (most used first) and return top 3
    return Array.from(parameterFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ parameterName, value, parameterId }) => ({
        parameterName,
        value,
        parameterId,
      }));
  };

  const handleSelect = (simulation: Simulation) => {
    const isSelected = selectedSimulations.some((s) => s.id === simulation.id);
    let newSelectedSimulations: Simulation[];

    if (isSelected) {
      // Remove from selection
      newSelectedSimulations = selectedSimulations.filter(
        (s) => s.id !== simulation.id
      );
    } else {
      // Add to selection
      newSelectedSimulations = [...selectedSimulations, simulation];
    }

    onSelect?.(newSelectedSimulations);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect?.([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (
    simulationToRemove: Simulation,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const newSelectedSimulations = selectedSimulations.filter(
      (s) => s.id !== simulationToRemove.id
    );
    onSelect?.(newSelectedSimulations);
  };

  const getButtonText = () => {
    if (selectedSimulations.length === 0) {
      return placeholder;
    }
    if (selectedSimulations.length === 1) {
      const title = selectedSimulations[0]!.title;
      return typeof title === "string" ? title : "Simulation selected";
    }
    return `${selectedSimulations.length} simulations selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  const formatTimeLimit = (timeLimit?: number) => {
    if (!timeLimit || timeLimit === 0) return "No time limit";
    if (timeLimit < 60) return `${timeLimit} minutes`;
    const hours = Math.floor(timeLimit / 60);
    const minutes = timeLimit % 60;
    if (minutes === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="grid gap-2">
      {showLabel && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="simulations">{label}</Label>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-[260px] text-sm"
            side="left"
          >
            {description}
          </HoverCardContent>
        </HoverCard>
      )}

      {/* Show selected items */}
      {selectedSimulations.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedSimulations.map((simulation) => (
            <div
              key={simulation.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{simulation.title}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(simulation, e)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${typeof simulation.title === "string" ? simulation.title : "simulation"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select simulations"
            className={cn("w-full justify-between", buttonClassName)}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[350px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {typeof peekedSimulation?.title === "string"
                    ? peekedSimulation.title
                    : "Simulation selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedSimulation?.description || "No description available"}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {formatTimeLimit(peekedSimulation?.timeLimit)}
                  </Badge>
                  {peekedSimulation?.defaultSimulation && (
                    <Badge variant="default" className="text-xs">
                      Default
                    </Badge>
                  )}
                  {peekedSimulation?.active && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      Active
                    </Badge>
                  )}
                  {peekedSimulation &&
                    getSimulationScenarioBadges(peekedSimulation)
                      .slice(0, 3)
                      .map((badge) => (
                        <TooltipProvider key={badge.parameterId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-xs">
                                {badge.value}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{badge.parameterName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                  {peekedSimulation &&
                    getSimulationScenarioBadges(peekedSimulation).length >
                      3 && (
                      <Badge variant="outline" className="text-xs">
                        +
                        {getSimulationScenarioBadges(peekedSimulation).length -
                          3}
                      </Badge>
                    )}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput
                  placeholder="Search simulations..."
                  endAdornment={
                    <Popover
                      open={filterPopoverOpen}
                      onOpenChange={setFilterPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Filter by persona/parameters"
                          title="Filter by persona/parameters"
                          className={cn(
                            "relative hover:bg-accent overflow-visible h-8 w-8 p-0",
                            filterPersonaIds.length > 0 ||
                              filterParameterItemIds.length > 0
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterPopoverOpen((prev) => !prev);
                          }}
                        >
                          <Filter className="h-4 w-4" />
                          {(filterPersonaIds.length > 0 ||
                            filterParameterItemIds.length > 0) &&
                            !filterPopoverOpen && (
                              <span
                                className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background z-10"
                                aria-label="Active filters"
                              />
                            )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        title="Filter by persona/parameters"
                        className="w-80 max-h-[30vh] p-0"
                        align="end"
                        side="top"
                        sideOffset={8}
                      >
                        <div className="max-h-[30vh] flex flex-col">
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-2">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">
                                Personas
                              </div>
                              <ScrollArea className="max-h-40 pr-2">
                                <div className="space-y-2">
                                  {personaOptions.length === 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      No personas available
                                    </div>
                                  )}
                                  {personaOptions.map((p) => {
                                    const checked = filterPersonaIds.includes(
                                      p.id
                                    );
                                    return (
                                      <label
                                        key={p.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(isChecked) => {
                                            setFilterPersonaIds((prev) => {
                                              if (isChecked) {
                                                if (prev.includes(p.id))
                                                  return prev;
                                                return [...prev, p.id];
                                              }
                                              return prev.filter(
                                                (x) => x !== p.id
                                              );
                                            });
                                          }}
                                        />
                                        <span className="truncate">
                                          {p.name}
                                        </span>
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          {p.count}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            </div>

                            <div className="space-y-2">
                              <div className="text-sm font-medium">
                                Parameters
                              </div>
                              <ScrollArea className="max-h-48 pr-2">
                                <div className="space-y-2">
                                  {parameterItemOptions.length === 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      No parameter items available
                                    </div>
                                  )}
                                  {parameterItemOptions.map((opt) => {
                                    const checked =
                                      filterParameterItemIds.includes(opt.id);
                                    return (
                                      <label
                                        key={opt.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(isChecked) => {
                                            setFilterParameterItemIds(
                                              (prev) => {
                                                if (isChecked) {
                                                  if (prev.includes(opt.id))
                                                    return prev;
                                                  return [...prev, opt.id];
                                                }
                                                return prev.filter(
                                                  (x) => x !== opt.id
                                                );
                                              }
                                            );
                                          }}
                                        />
                                        <span className="truncate">
                                          {opt.label}
                                        </span>
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          {opt.count}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            </div>
                          </div>

                          <div className="p-2 border-t flex justify-between items-center">
                            <div className="text-xs text-muted-foreground">
                              {filterPersonaIds.length +
                                filterParameterItemIds.length}{" "}
                              selected
                            </div>
                            <div className="flex gap-2">
                              {(filterPersonaIds.length > 0 ||
                                filterParameterItemIds.length > 0) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setFilterPersonaIds([]);
                                    setFilterParameterItemIds([]);
                                  }}
                                >
                                  Clear
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => setFilterPopoverOpen(false)}
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  }
                />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedSimulations.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Simulations">
                  {sortedFilteredSimulations.map((simulation) => (
                    <SimulationItem
                      key={simulation.id}
                      simulation={simulation}
                      isSelected={selectedSimulations.some(
                        (s) => s.id === simulation.id
                      )}
                      onPeek={(simulation) => setPeekedSimulation(simulation)}
                      onSelect={() => handleSelect(simulation)}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface SimulationItemProps {
  simulation: Simulation;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (simulation: Simulation) => void;
}

function SimulationItem({
  simulation,
  isSelected,
  onSelect,
  onPeek,
}: SimulationItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(simulation);
      }
    });
  });

  return (
    <CommandItem
      key={simulation.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Play className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{simulation.title}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate">
              {simulation.description || "No description available"}
            </div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </CommandItem>
  );
}
