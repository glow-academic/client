/**
 * SimulationScenarioPicker.tsx
 * Used to pick scenarios for simulations with parameter badges
 * Refactored to use mapping-based API pattern
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
import type {
  MappingItem,
  ParameterItemMappingItem,
} from "@/lib/api/v2/schemas/base";
import { cn } from "@/lib/utils";

// Extended mapping item for scenarios with parameter item IDs
export interface ScenarioMappingItemExt extends MappingItem {
  parameterItemIds?: string[];
  updatedAt?: string;
}

export interface SimulationScenarioPickerProps<
  T extends ScenarioMappingItemExt = ScenarioMappingItemExt,
> extends PopoverProps {
  scenarioMapping: Record<string, T>;
  validScenarioIds: string[];
  selectedScenarioIds: string[];
  onSelect: (ids: string[]) => void;
  parameterItemMapping: Record<string, ParameterItemMappingItem>;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  showOnlyActive?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
  isPracticeSimulation?: boolean;
}

export function SimulationScenarioPicker<
  T extends ScenarioMappingItemExt = ScenarioMappingItemExt,
>({
  scenarioMapping,
  validScenarioIds,
  selectedScenarioIds,
  onSelect,
  parameterItemMapping,
  label = "Scenarios",
  placeholder = "Select scenarios...",
  description = "Select one or more scenarios to assign to the simulation.",
  hideSelectedChips = true,
  showLabel = true,
  buttonClassName,
  ...props
}: SimulationScenarioPickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterParameterItemIds, setFilterParameterItemIds] = React.useState<
    string[]
  >([]);

  // Build scenarios from mapping (server already filters to root scenarios only)
  const baseScenarios = React.useMemo(() => {
    const scenarios = validScenarioIds.map((id) => ({
      id,
      ...scenarioMapping[id],
    }));

    // Sort by updatedAt desc, then name
    return scenarios.sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bd !== ad) return bd - ad;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [validScenarioIds, scenarioMapping]);

  // Build frequency-ranked parameter item options across base scenarios
  const parameterItemOptions = React.useMemo(() => {
    const countMap = new Map<string, number>();
    baseScenarios.forEach((sc) => {
      (sc.parameterItemIds || []).forEach((id) => {
        countMap.set(id, (countMap.get(id) || 0) + 1);
      });
    });
    const rows = Array.from(countMap.entries())
      .filter(([id]) => Boolean(parameterItemMapping[id]))
      .map(([id, count]) => {
        const item = parameterItemMapping[id]!;
        const label = `${item.parameter_name}: ${item.name}`;
        return { id, label, count };
      });
    rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return rows;
  }, [baseScenarios, parameterItemMapping]);

  // Apply parameter item filters (all-of) - baseScenarios is already sorted
  const filteredScenarios = React.useMemo(() => {
    if (filterParameterItemIds.length === 0) return baseScenarios;
    return baseScenarios.filter((sc) => {
      const ids = new Set(sc.parameterItemIds || []);
      return filterParameterItemIds.every((id) => ids.has(id));
    });
  }, [baseScenarios, filterParameterItemIds]);

  const [peekedScenario, setPeekedScenario] = React.useState<
    ({ id: string } & T) | undefined
  >(filteredScenarios[0] as ({ id: string } & T) | undefined);

  const handleSelect = (scenarioId: string) => {
    const isSelected = selectedScenarioIds.includes(scenarioId);
    const newIds = isSelected
      ? selectedScenarioIds.filter((id) => id !== scenarioId)
      : [...selectedScenarioIds, scenarioId];
    onSelect(newIds);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedScenarioIds.filter((id) => id !== scenarioId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedScenarioIds.length === 0) {
      return placeholder;
    }
    if (selectedScenarioIds.length === 1) {
      const scenario = scenarioMapping[selectedScenarioIds[0]!];
      return scenario?.name || placeholder;
    }
    return `${selectedScenarioIds.length} scenarios selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Helper to render parameter badges in hover (keep for richer preview)
  const getScenarioParameterBadges = (scenario: { id: string } & T) => {
    if (!scenario.parameterItemIds || scenario.parameterItemIds.length === 0) {
      return [];
    }
    const badges: {
      parameterName: string;
      value: string;
      parameterId: string;
    }[] = [];
    scenario.parameterItemIds.forEach((parameterItemId) => {
      const parameterItem = parameterItemMapping[parameterItemId];
      if (parameterItem) {
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
      {selectedScenarioIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedScenarioIds.map((id) => {
            const scenario = scenarioMapping[id];
            if (!scenario) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{scenario.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${scenario.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
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
                  {peekedScenario?.name || "Scenario selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedScenario?.description || "No description available"}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {peekedScenario && (
                    <>
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
                        )
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
                              : "text-muted-foreground"
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
                {selectedScenarioIds.length > 0 && (
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
                  {filteredScenarios.map((scenario) => (
                    <ScenarioItem
                      key={scenario.id}
                      scenario={scenario as { id: string } & T}
                      isSelected={selectedScenarioIds.includes(scenario.id)}
                      onPeek={(s) => setPeekedScenario(s)}
                      onSelect={() => handleSelect(scenario.id)}
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

interface ScenarioItemProps<T extends ScenarioMappingItemExt> {
  scenario: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (scenario: { id: string } & T) => void;
}

function ScenarioItem<T extends ScenarioMappingItemExt>({
  scenario,
  isSelected,
  onSelect,
  onPeek,
}: ScenarioItemProps<T>) {
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
            <div className="truncate">{scenario.name}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate">
              {scenario.description || "No description available"}
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
