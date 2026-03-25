/**
 * DepartmentPicker.tsx
 * Used to pick departments for filtering analytics
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
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

export interface Department {
  id: string;
  title: string;
  description?: string;
}

export interface DepartmentSelectorProps extends PopoverProps {
  departments: Department[];
  placeholder?: string;
  onSelect?: (departments: Department[]) => void;
  selectedDepartments?: Department[];
  hideSelectedChips?: boolean;
}

export function DepartmentSelector({
  departments,
  placeholder = "Departments",
  onSelect,
  selectedDepartments = [],
  hideSelectedChips = true,
  ...props
}: DepartmentSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (department: Department) => {
    const isSelected = selectedDepartments.some((d) => d.id === department.id);
    let newSelectedDepartments: Department[];

    if (isSelected) {
      // Remove from selection
      newSelectedDepartments = selectedDepartments.filter(
        (d) => d.id !== department.id,
      );
    } else {
      // Add to selection
      newSelectedDepartments = [...selectedDepartments, department];
    }

    onSelect?.(newSelectedDepartments);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect?.([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (
    departmentToRemove: Department,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const newSelectedDepartments = selectedDepartments.filter(
      (d) => d.id !== departmentToRemove.id,
    );
    onSelect?.(newSelectedDepartments);
  };

  const getButtonText = () => {
    if (selectedDepartments.length === 0) {
      return placeholder;
    }
    if (selectedDepartments.length === 1) {
      return selectedDepartments[0]!.title;
    }
    return `${selectedDepartments.length} departments selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No departments found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedDepartments.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedDepartments.map((department) => (
            <div
              key={department.id}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{department.title}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(department, e)}
                className="text-muted-foreground hover:text-destructive"
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
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            aria-label="Select departments"
            className="w-full justify-between"
            size="sm"
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[220px] p-0">
          <Command loop>
            <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
              <CommandInput placeholder="Search departments..." />
              <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
              {selectedDepartments.length > 0 && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    Clear All
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Departments">
                {departments.map((department) => (
                  <DepartmentItem
                    key={department.id}
                    department={department}
                    isSelected={selectedDepartments.some(
                      (d) => d.id === department.id,
                    )}
                    onSelect={() => handleSelect(department)}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DepartmentItemProps {
  department: Department;
  isSelected: boolean;
  onSelect: () => void;
}

function DepartmentItem({
  department,
  isSelected,
  onSelect,
}: DepartmentItemProps) {
  return (
    <CommandItem key={department.id} onSelect={onSelect}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">{department.title}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
