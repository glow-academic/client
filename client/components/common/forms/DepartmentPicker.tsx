/**
 * DepartmentPicker.tsx
 * Used to pick departments for filtering or assignment
 * Refactored to use mapping-based API pattern
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

type MappingItem = {
  name: string;
  description: string;
};

type TriggerButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "data-testid"
> & {
  "data-testid"?: string;
};

export interface DepartmentPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
  compact?: boolean; // Compact mode for single-select, smaller button
  triggerProps?: TriggerButtonProps;
}

export function DepartmentPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  placeholder = "Select departments...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  compact = false,
  triggerProps,
  ...props
}: DepartmentPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build departments from mapping
  const departments = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    })) as ({ id: string } & T)[];
  }, [validIds, mapping]);

  const [peekedDepartment, setPeekedDepartment] = React.useState<
    ({ id: string } & T) | undefined
  >(departments[0]);

  const handleSelect = (departmentId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(departmentId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== departmentId)
        : [...selectedIds, departmentId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([departmentId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (departmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== departmentId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return compact ? "All Departments" : placeholder;
    }
    if (selectedIds.length === 1) {
      const department = mapping[selectedIds[0]!];
      return department?.name || placeholder;
    }
    return `${selectedIds.length} departments selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No departments found.`;
  };

  const { className: triggerClassName, ...restTriggerProps } =
    triggerProps ?? {};

  const buttonClasses = cn(
    compact ? "h-8 justify-between" : "w-full justify-between",
    buttonClassName,
    triggerClassName
  );

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const department = mapping[id];
            if (!department) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{department.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select departments"
            className={buttonClasses}
            disabled={disabled}
            {...restTriggerProps}
          >
            <span className="truncate text-left">{getButtonText()}</span>
            <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
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
                  {peekedDepartment?.name || "No department selected"}
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
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear {multiSelect ? "All" : "Selection"}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Departments">
                  {departments.map((department) => (
                    <DepartmentItem
                      key={department.id}
                      department={department}
                      isSelected={selectedIds.includes(department.id)}
                      onPeek={(department) => setPeekedDepartment(department)}
                      onSelect={() => handleSelect(department.id)}
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

interface DepartmentItemProps<T extends MappingItem> {
  department: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (department: { id: string } & T) => void;
}

function DepartmentItem<T extends MappingItem>({
  department,
  isSelected,
  onSelect,
  onPeek,
}: DepartmentItemProps<T>) {
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
      data-testid="department-option"
      data-department-id={department.id}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{department.name}</div>
            {department.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {department.description}
              </div>
            )}
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
