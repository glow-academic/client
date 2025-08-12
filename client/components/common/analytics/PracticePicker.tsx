/**
 * PracticePicker.tsx
 * Multi-select picker for general/practice content selection
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
import { cn } from "@/lib/utils";

export type PracticeOption = "general" | "practice";

export interface PracticePickerProps {
  options?: PracticeOption[]; // defaults to ["general", "practice"]
  selected?: PracticeOption[]; // any subset of options
  onChange?: (selected: PracticeOption[]) => void;
  placeholder?: string;
  className?: string;
  hideSelectedChips?: boolean;
}

const LABEL: Record<PracticeOption, string> = {
  general: "General",
  practice: "Practice",
};

export function PracticePicker({
  options = ["general", "practice"],
  selected = [],
  onChange,
  placeholder = "All simulations",
  className,
  hideSelectedChips = true,
}: PracticePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: PracticeOption) => {
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
    if (selected.length === 2) return "General + Practice";
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
