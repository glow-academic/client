/**
 * SimulationScenarioPicker.tsx
 * Used to pick scenarios for simulations with parameter badges
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Play, X } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ...props
}: SimulationScenarioPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedScenario, setPeekedScenario] = React.useState<
    SimulationScenario | undefined
  >(scenarios[0]);

  // Filter scenarios to show only active ones if requested
  const filteredScenarios = showOnlyActive
    ? scenarios.filter((scenario) => scenario.active)
    : scenarios;

  // Create a map of parameter items by ID for quick lookup
  const parameterItemsMap = React.useMemo(() => {
    return parameterItems.reduce(
      (acc, item) => {
        acc[item.id] = item;
        return acc;
      },
      {} as Record<string, ParameterItem>
    );
  }, [parameterItems]);

  // Create a map of parameters by ID for quick lookup
  const parametersMap = React.useMemo(() => {
    return parameters.reduce(
      (acc, param) => {
        acc[param.id] = param;
        return acc;
      },
      {} as Record<string, Parameter>
    );
  }, [parameters]);

  const handleSelect = (scenario: SimulationScenario) => {
    const isSelected = selectedScenarios.some((s) => s.id === scenario.id);
    let newSelectedScenarios: SimulationScenario[];

    if (isSelected) {
      // Remove from selection
      newSelectedScenarios = selectedScenarios.filter(
        (s) => s.id !== scenario.id
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
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const newSelectedScenarios = selectedScenarios.filter(
      (s) => s.id !== scenarioToRemove.id
    );
    onSelect?.(newSelectedScenarios);
  };

  const getButtonText = () => {
    if (selectedScenarios.length === 0) {
      return placeholder;
    }
    if (selectedScenarios.length === 1) {
      const title = selectedScenarios[0]!.title;
      return typeof title === "string" ? title : "Scenario selected";
    }
    return `${selectedScenarios.length} scenarios selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Get parameter badges for a scenario
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
          // Only show non-numerical parameters
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
      {selectedScenarios.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedScenarios.map((scenario) => (
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
                      {peekedScenario.practiceScenario && (
                        <Badge variant="secondary" className="text-xs">
                          Practice
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
                        )
                      )}
                    </>
                  )}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search scenarios..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedScenarios.length > 0 && (
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
                      scenario={scenario}
                      isSelected={selectedScenarios.some(
                        (s) => s.id === scenario.id
                      )}
                      onPeek={(scenario) => setPeekedScenario(scenario)}
                      onSelect={() => handleSelect(scenario)}
                      getParameterBadges={getScenarioParameterBadges}
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

interface ScenarioItemProps {
  scenario: SimulationScenario;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (scenario: SimulationScenario) => void;
  getParameterBadges: (
    scenario: SimulationScenario
  ) => { parameterName: string; value: string; parameterId: string }[];
}

function ScenarioItem({
  scenario,
  isSelected,
  onSelect,
  onPeek,
  getParameterBadges,
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

  const parameterBadges = getParameterBadges(scenario);

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
            <div className="flex items-center gap-1 mt-1">
              {scenario.practiceScenario && (
                <Badge variant="default" className="text-xs">
                  Practice
                </Badge>
              )}
              {parameterBadges.slice(0, 2).map((badge) => (
                <TooltipProvider key={badge.parameterId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs">
                        {badge.value}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{badge.parameterName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {parameterBadges.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{parameterBadges.length - 2}
                </Badge>
              )}
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
