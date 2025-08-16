/**
 * PracticePicker.tsx
 * Multi-select picker for general/practice/archived content selection
 */
"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { SimulationFilter } from "@/contexts/analytics-context";
import { cn } from "@/lib/utils";

export interface PracticePickerProps {
  options?: SimulationFilter[]; // defaults to ["general", "practice", "archived"]
  selected?: SimulationFilter[]; // any subset of options
  onChange?: (selected: SimulationFilter[]) => void;
  placeholder?: string;
  className?: string;
  hideSelectedChips?: boolean;
}

const LABEL: Record<SimulationFilter, string> = {
  general: "General",
  practice: "Practice",
  archived: "Archived",
};

export function PracticePicker({
  options = ["general", "practice", "archived"],
  selected = [],
  onChange,
  placeholder = "All simulations",
  className,
  hideSelectedChips = true,
}: PracticePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: SimulationFilter) => {
    const isSelected = selected.includes(value);
    const updated = isSelected
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange?.(updated);
  };

  const handleClear = () => {
    onChange?.([]);
    setOpen(false);
  };

  const getButtonText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return LABEL[selected[0]!];
    if (selected.length === 2) {
      const labels = selected.map((s) => LABEL[s]).join(" + ");
      return labels;
    }
    if (selected.length === 3) return "All simulations";
    return `${selected.length} selected`;
  };

  return (
    <div className={className}>
      {selected.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((opt) => (
            <div
              key={opt}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{LABEL[opt]}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(selected.filter((o) => o !== opt));
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            aria-label="Select content type"
            className={cn("justify-between min-w-[100px]", className)}
            size="sm"
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[220px] p-0">
          <Command loop>
            <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
              <CommandInput placeholder="Search simulations..." />
              <CommandEmpty>No options found.</CommandEmpty>
              {selected.length > 0 && (
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
                {options.map((opt) => {
                  const isSelected = selected.includes(opt);
                  return (
                    <CommandItem key={opt} onSelect={() => handleSelect(opt)}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {LABEL[opt]}
                        </div>
                        <Check
                          className={cn(
                            "ml-auto",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
