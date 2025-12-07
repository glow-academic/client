/**
 * PricingTypePicker.tsx
 * Simple picker for pricing types (input/output/cached)
 * @AshokSaravanan222
 * 12/02/2025
 */

"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PricingType = "input" | "output" | "cached";

const PRICING_TYPES: { value: PricingType; label: string }[] = [
  { value: "input", label: "Input" },
  { value: "output", label: "Output" },
  { value: "cached", label: "Cached" },
];

export interface PricingTypePickerProps {
  selectedType: PricingType;
  onSelect: (type: PricingType) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function PricingTypePicker({
  selectedType,
  onSelect,
  placeholder = "Select type...",
  disabled = false,
  buttonClassName,
}: PricingTypePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel =
    PRICING_TYPES.find((pt) => pt.value === selectedType)?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select pricing type"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No type found.</CommandEmpty>
            <CommandGroup>
              {PRICING_TYPES.map((pt) => (
                <CommandItem
                  key={pt.value}
                  onSelect={() => {
                    onSelect(pt.value);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  {pt.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      selectedType === pt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
