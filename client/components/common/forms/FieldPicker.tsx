/**
 * FieldPicker.tsx
 * Used to pick fields for parameter assignment
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
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

type MappingItem = {
  name: string;
  description?: string;
  usage_count?: number;
  department_ids?: string[] | null;
};

type TriggerButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "data-testid"
> & {
  "data-testid"?: string;
};

export interface FieldPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  buttonClassName?: string;
  disabled?: boolean;
  triggerProps?: TriggerButtonProps;
}

export function FieldPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = true,
  placeholder = "Select fields...",
  buttonClassName,
  disabled = false,
  triggerProps,
  ...props
}: FieldPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build fields from mapping
  const fields = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    })) as ({ id: string } & T)[];
  }, [validIds, mapping]);

  const handleSelect = (fieldId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(fieldId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== fieldId)
        : [...selectedIds, fieldId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([fieldId]);
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            buttonClassName,
            disabled && "cursor-not-allowed opacity-50",
          )}
          disabled={disabled}
          {...triggerProps}
        >
          <span className="truncate">
            {selectedIds.length === 0
              ? placeholder
              : multiSelect
                ? `${selectedIds.length} field${selectedIds.length === 1 ? "" : "s"} selected`
                : mapping[selectedIds[0]]?.name || selectedIds[0]?.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1">
            {selectedIds.length > 0 && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields..." />
          <CommandList>
            <CommandEmpty>No fields found.</CommandEmpty>
            <CommandGroup>
              {fields.map((field) => {
                const isSelected = selectedIds.includes(field.id);
                return (
                  <CommandItem
                    key={field.id}
                    value={field.id}
                    onSelect={() => handleSelect(field.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{field.name}</span>
                      {field.description && (
                        <span className="text-xs text-muted-foreground">
                          {field.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

