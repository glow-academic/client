/**
 * SimulationPicker.tsx
 * Used to pick simulations for filtering or assignment to cohorts
 * Simplified to use mapping-based API pattern without filtering
 * @AshokSaravanan222 & @siladiea
 * 10/25/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

type SimulationMappingItem = {
  name: string;
  description: string;
  time_limit?: number | null;
  department_ids?: string[] | null;
};

export interface SimulationPickerProps extends PopoverProps {
  simulationMapping: Record<string, SimulationMappingItem>;
  validSimulationIds: string[];
  selectedSimulationIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function SimulationPicker({
  simulationMapping,
  validSimulationIds,
  selectedSimulationIds,
  onSelect,
  multiSelect = true,
  label = "Simulations",
  placeholder = "Select simulations...",
  description = "Select one or more simulations to assign to the cohort.",
  hideSelectedChips = true,
  showLabel = true,
  buttonClassName,
  disabled = false,
  ...props
}: SimulationPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Build simulations from mapping
  const baseSimulations = React.useMemo(() => {
    return validSimulationIds.map((id) => ({
      id,
      ...simulationMapping[id],
    }));
  }, [validSimulationIds, simulationMapping]);

  // Sort by name alphabetically
  const sortedSimulations = React.useMemo(() => {
    return [...baseSimulations].sort((a, b) => {
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseSimulations]);

  const [peekedSimulation, setPeekedSimulation] = React.useState<
    ({ id: string } & SimulationMappingItem) | undefined
  >(
    sortedSimulations[0] as
      | ({ id: string } & SimulationMappingItem)
      | undefined,
  );

  const handleSelect = (simulationId: string) => {
    if (multiSelect) {
      const isSelected = selectedSimulationIds.includes(simulationId);
      const newIds = isSelected
        ? selectedSimulationIds.filter((id) => id !== simulationId)
        : [...selectedSimulationIds, simulationId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([simulationId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (simulationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedSimulationIds.filter((id) => id !== simulationId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedSimulationIds.length === 0) {
      return placeholder;
    }
    if (selectedSimulationIds.length === 1) {
      const simulation = simulationMapping[selectedSimulationIds[0]!];
      return simulation?.name || placeholder;
    }
    return `${selectedSimulationIds.length} simulations selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  const formatTimeLimit = (timeLimit?: number | null) => {
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
      {selectedSimulationIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedSimulationIds.map((id) => {
            const simulation = simulationMapping[id];
            if (!simulation) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{simulation.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${simulation.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select simulations"
            className={cn("w-full justify-between", buttonClassName)}
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
          className="w-[350px] p-0"
        >
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[150px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedSimulation?.name || "Simulation selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedSimulation?.description || "No description available"}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {formatTimeLimit(peekedSimulation?.time_limit)}
                  </Badge>
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[300px]">
                <CommandInput placeholder="Search simulations..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedSimulationIds.length > 0 && (
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
                  {sortedSimulations.map((simulation) => (
                    <SimulationItem
                      key={simulation.id}
                      simulation={
                        simulation as { id: string } & SimulationMappingItem
                      }
                      isSelected={selectedSimulationIds.includes(simulation.id)}
                      onPeek={(s) => setPeekedSimulation(s)}
                      onSelect={() => handleSelect(simulation.id)}
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
  simulation: { id: string } & SimulationMappingItem;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (simulation: { id: string } & SimulationMappingItem) => void;
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
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{simulation.name}</div>
            <div className="mt-1 text-xs truncate text-muted-foreground group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
              {simulation.description || "No description available"}
            </div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}
