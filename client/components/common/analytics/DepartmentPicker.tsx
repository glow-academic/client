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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

export interface Department {
  id: string;
  title: string;
  description?: string;
}

export interface DepartmentPickerProps extends PopoverProps {
  departments: Department[];
  placeholder?: string;
  onSelect?: (departments: Department[]) => void;
  selectedDepartments?: Department[];
  hideSelectedChips?: boolean;
}

export function DepartmentPicker({
  departments,
  placeholder = "Select departments...",
  onSelect,
  selectedDepartments = [],
  hideSelectedChips = true,
  ...props
}: DepartmentPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedDepartment, setPeekedDepartment] = React.useState<
    Department | undefined
  >(departments[0]);

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
        <PopoverContent align="end" className="w-[300px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedDepartment?.title || "Department selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedDepartment?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search departments..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
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
                      onPeek={(department) => setPeekedDepartment(department)}
                      onSelect={() => handleSelect(department)}
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

interface DepartmentItemProps {
  department: Department;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (department: Department) => void;
}

function DepartmentItem({
  department,
  isSelected,
  onSelect,
  onPeek,
}: DepartmentItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(department);
      }
    });
  });

  return (
    <CommandItem
      key={department.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">{department.title}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
