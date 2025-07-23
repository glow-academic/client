/**
 * SimulationPicker.tsx
 * Used to pick simulations for filtering or assignment to cohorts
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
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

export interface Simulation {
  id: string;
  title: string | React.ReactNode;
  description?: string;
  timeLimit?: number | undefined;
  active: boolean;
  defaultSimulation?: boolean;
  practiceSimulation?: boolean;
}

export interface SimulationPickerProps extends PopoverProps {
  simulations: Simulation[];
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

  // Filter simulations to show only active ones if requested
  const filteredSimulations = showOnlyActive
    ? simulations.filter((sim) => sim.active)
    : simulations;

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
                  {peekedSimulation?.practiceSimulation && (
                    <Badge variant="secondary" className="text-xs">
                      Practice
                    </Badge>
                  )}
                  {peekedSimulation?.active && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search simulations..." />
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
                  {filteredSimulations.map((simulation) => (
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

  const formatTimeLimit = (timeLimit?: number) => {
    if (!timeLimit || timeLimit === 0) return "No limit";
    if (timeLimit < 60) return `${timeLimit}m`;
    const hours = Math.floor(timeLimit / 60);
    const minutes = timeLimit % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

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
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-xs">
                {formatTimeLimit(simulation.timeLimit)}
              </Badge>
              {simulation.practiceSimulation && (
                <Badge variant="default" className="text-xs">
                  Practice
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
