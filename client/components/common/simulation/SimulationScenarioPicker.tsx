/**
 * SimulationScenarioPicker.tsx
 * Used to pick scenarios for simulations with parameter badges
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

export interface SimulationScenario {
  id: string;
  title: string | React.ReactNode;
  description?: string;
  active: boolean;
  defaultScenario?: boolean;
  practiceScenario?: boolean;
  parameterItemIds?: string[];
  parentId?: string | null;
  updatedAt?: string;
}

export interface SimulationScenarioPickerProps extends PopoverProps {
  scenarios: SimulationScenario[];
  parameters: Parameter[];
  parameterItems: ParameterItem[];
  label?: string;
  placeholder?: string;
  description?: string;
  onSelect?: (scenarios: SimulationScenario[]) => void;
  selectedScenarios?: SimulationScenario[];
  hideSelectedChips?: boolean;
  showOnlyActive?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
  isPracticeSimulation?: boolean;
}

export function SimulationScenarioPicker({
  scenarios,
  parameters,
  parameterItems,
  label = "Scenarios",
  placeholder = "Select scenarios...",
  description = "Select one or more scenarios to assign to the simulation.",
  onSelect,
  selectedScenarios = [],
  hideSelectedChips = true,
  showOnlyActive = true,
  showLabel = true,
  buttonClassName,
  isPracticeSimulation = false,
  ...props
}: SimulationScenarioPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedScenario, setPeekedScenario] = React.useState<
    SimulationScenario | undefined
  >(scenarios[0]);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterParameterItemIds, setFilterParameterItemIds] = React.useState<
    string[]
  >([]);

  // Get current selection based on practice simulation mode
  const currentSelection = React.useMemo(() => {
    if (isPracticeSimulation) {
      return selectedScenarios.filter(
        (scenario) => scenario.practiceScenario === true,
      );
    } else {
      return selectedScenarios.filter(
        (scenario) => scenario.practiceScenario !== true,
      );
    }
  }, [selectedScenarios, isPracticeSimulation]);

  // Filter scenarios based on practice simulation toggle and other criteria, then sort by updatedAt
  const baseScenarios = React.useMemo(() => {
    const filtered = (
      showOnlyActive
        ? scenarios.filter((scenario) => scenario.active)
        : scenarios
    ).filter((scenario) => {
      // Only show parent scenarios (parentId is null)
      if (scenario.parentId !== null) return false;

      // If practice simulation is enabled, only show practice scenarios
      if (isPracticeSimulation) {
        return scenario.practiceScenario === true;
      }

      // If practice simulation is disabled, exclude practice scenarios
      return scenario.practiceScenario !== true;
    });

    // Sort by updatedAt desc, then title
    return filtered.sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bd !== ad) return bd - ad;
      const at = typeof a.title === "string" ? a.title : "";
      const bt = typeof b.title === "string" ? b.title : "";
      return at.localeCompare(bt);
    });
  }, [scenarios, showOnlyActive, isPracticeSimulation]);

  // Create a map of parameter items by ID for quick lookup
  const parameterItemsMap = React.useMemo(() => {
    return parameterItems.reduce(
      (acc, item) => {
        acc[item.id] = item;
        return acc;
      },
      {} as Record<string, ParameterItem>,
    );
  }, [parameterItems]);

  // Create a map of parameters by ID for quick lookup
  const parametersMap = React.useMemo(() => {
    return parameters.reduce(
      (acc, param) => {
        acc[param.id] = param;
        return acc;
      },
      {} as Record<string, Parameter>,
    );
  }, [parameters]);

  // Build frequency-ranked parameter item options across base scenarios
  const parameterItemOptions = React.useMemo(() => {
    const countMap = new Map<string, number>();
    baseScenarios.forEach((sc) => {
      (sc.parameterItemIds || []).forEach((id) => {
        countMap.set(id, (countMap.get(id) || 0) + 1);
      });
    });
    const rows = Array.from(countMap.entries())
      .filter(([id]) => Boolean(parameterItemsMap[id]))
      .map(([id, count]) => {
        const item = parameterItemsMap[id]!;
        const param = parametersMap[item.parameterId];
        const label = param ? `${param.name}: ${item.value}` : item.value;
        return { id, label, count };
      });
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return rows;
  }, [baseScenarios, parameterItemsMap, parametersMap]);

  // Apply parameter item filters (all-of) - baseScenarios is already sorted
  const filteredScenarios = React.useMemo(() => {
    if (filterParameterItemIds.length === 0) return baseScenarios;
    return baseScenarios.filter((sc) => {
      const ids = new Set(sc.parameterItemIds || []);
      return filterParameterItemIds.every((id) => ids.has(id));
    });
  }, [baseScenarios, filterParameterItemIds]);

  const handleSelect = (scenario: SimulationScenario) => {
    const isSelected = selectedScenarios.some((s) => s.id === scenario.id);
    let newSelectedScenarios: SimulationScenario[];

    if (isSelected) {
      // Remove from selection
      newSelectedScenarios = selectedScenarios.filter(
        (s) => s.id !== scenario.id,
      );
    } else {
      // Add to selection
      newSelectedScenarios = [...selectedScenarios, scenario];
    }

    onSelect?.(newSelectedScenarios);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect?.([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (
    scenarioToRemove: SimulationScenario,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const newSelectedScenarios = selectedScenarios.filter(
      (s) => s.id !== scenarioToRemove.id,
    );
    onSelect?.(newSelectedScenarios);
  };

  const getButtonText = () => {
    if (currentSelection.length === 0) {
      return placeholder;
    }
    if (currentSelection.length === 1) {
      const title = currentSelection[0]!.title;
      return typeof title === "string" ? title : "Scenario selected";
    }
    return `${currentSelection.length} scenarios selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Helper to render parameter badges in hover (keep for richer preview)
  const getScenarioParameterBadges = (scenario: SimulationScenario) => {
    if (!scenario.parameterItemIds || scenario.parameterItemIds.length === 0) {
      return [];
    }
    const badges: {
      parameterName: string;
      value: string;
      parameterId: string;
    }[] = [];
    scenario.parameterItemIds.forEach((parameterItemId) => {
      const parameterItem = parameterItemsMap[parameterItemId];
      if (parameterItem) {
        const parameter = parametersMap[parameterItem.parameterId];
        if (parameter && !parameter.numerical) {
          badges.push({
            parameterName: parameter.name,
            value: parameterItem.value,
            parameterId: parameter.id,
          });
        }
      }
    });
    return badges;
  };

  return (
    <div className="grid gap-2">
      {showLabel && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="scenarios">{label}</Label>
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
      {currentSelection.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {currentSelection.map((scenario) => (
            <div
              key={scenario.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{scenario.title}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(scenario, e)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${typeof scenario.title === "string" ? scenario.title : "scenario"}`}
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
            aria-label="Select scenarios"
            className={cn("w-full justify-between", buttonClassName)}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {typeof peekedScenario?.title === "string"
                    ? peekedScenario.title
                    : "Scenario selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedScenario?.description || "No description available"}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {peekedScenario && (
                    <>
                      {peekedScenario.defaultScenario && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}

                      {peekedScenario.active && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600"
                        >
                          Active
                        </Badge>
                      )}
                      {getScenarioParameterBadges(peekedScenario).map(
                        (badge) => (
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
                        ),
                      )}
                    </>
                  )}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput
                  placeholder="Search scenarios..."
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
                          aria-label="Filter by parameters"
                          title="Filter by parameters"
                          className={cn(
                            "relative hover:bg-accent overflow-visible h-8 w-8 p-0",
                            filterParameterItemIds.length > 0
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterPopoverOpen((prev) => !prev);
                          }}
                        >
                          <Filter className="h-4 w-4" />
                          {filterParameterItemIds.length > 0 &&
                            !filterPopoverOpen && (
                              <span
                                className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background z-10"
                                aria-label="Active filters"
                              />
                            )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        title="Filter by parameters"
                        className="w-80 max-h-[30vh] p-0"
                        align="end"
                        side="top"
                        sideOffset={8}
                      >
                        <div className="max-h-[30vh] flex flex-col">
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-2">
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
                                                  (x) => x !== opt.id,
                                                );
                                              },
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
                              {filterParameterItemIds.length} selected
                            </div>
                            <div className="flex gap-2">
                              {filterParameterItemIds.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFilterParameterItemIds([])}
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
                {currentSelection.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Scenarios">
                  {filteredScenarios.map((scenario) => {
                    const isSelected = selectedScenarios.some(
                      (s) => s.id === scenario.id,
                    );

                    return (
                      <ScenarioItem
                        key={scenario.id}
                        scenario={scenario}
                        isSelected={isSelected}
                        onPeek={(scenario) => setPeekedScenario(scenario)}
                        onSelect={() => handleSelect(scenario)}
                      />
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ScenarioItemProps {
  scenario: SimulationScenario;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (scenario: SimulationScenario) => void;
}

function ScenarioItem({
  scenario,
  isSelected,
  onSelect,
  onPeek,
}: ScenarioItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(scenario);
      }
    });
  });

  return (
    <CommandItem
      key={scenario.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Play className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{scenario.title}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate">
              {scenario.description || "No description available"}
            </div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}
