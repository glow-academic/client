/**
 * UnitPicker.tsx
 * Used to pick units for pricing configuration
 * Based on ReasoningPicker pattern
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface UnitItem {
  id: string;
  name: string;
  unit_category: string; // 'tokens' | 'seconds' | 'units'
  value: number;
}

export interface UnitPickerProps extends PopoverProps {
  units: UnitItem[];
  selectedId: string | null;
  onSelect: (unitId: string | null) => void;
  placeholder?: string;
  buttonClassName?: string;
  disabled?: boolean;
  filterByCategory?: string; // Optional filter by unit_category
}

export function UnitPicker({
  units,
  selectedId,
  onSelect,
  placeholder = "Select unit...",
  buttonClassName,
  disabled = false,
  filterByCategory,
  ...props
}: UnitPickerProps) {
  const [open, setOpen] = React.useState(false);

  const filteredUnits = React.useMemo(() => {
    if (filterByCategory) {
      return units.filter((u) => u.unit_category === filterByCategory);
    }
    return units;
  }, [units, filterByCategory]);

  const groupedUnits = React.useMemo(() => {
    const groups: Record<string, UnitItem[]> = {};
    filteredUnits.forEach((unit) => {
      const category = unit.unit_category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category]!.push(unit);
    });
    return groups;
  }, [filteredUnits]);

  const handleSelect = (unitId: string) => {
    onSelect(unitId);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedId) {
      return placeholder;
    }
    const unit = units.find((u) => u.id === selectedId);
    if (!unit) return placeholder;
    return `${unit.name} (${unit.value.toLocaleString()})`;
  };

  const selectedUnit = units.find((u) => u.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select unit"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search units..." />
            <CommandEmpty>No units found.</CommandEmpty>
            {selectedId && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={handleClear}
                  className="text-muted-foreground"
                >
                  Clear Selection
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(groupedUnits).map(([category, categoryUnits]) => (
              <CommandGroup key={category} heading={category.toUpperCase()}>
                {categoryUnits.map((unit) => (
                  <CommandItem
                    key={unit.id}
                    onSelect={() => handleSelect(unit.id)}
                    className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{unit.name}</div>
                          <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                            Value: {unit.value.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
                          selectedId === unit.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
