/**
 * DepartmentPicker.tsx
 * Used to pick departments for filtering analytics
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
import type { MappingItem } from "@/lib/api/v2/schemas/base";
import { cn } from "@/lib/utils";

export interface DepartmentPickerProps<T extends MappingItem = MappingItem>
  extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  placeholder?: string;
  hideSelectedChips?: boolean;
}

export function DepartmentPicker<T extends MappingItem = MappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  placeholder = "Departments",
  hideSelectedChips = true,
  ...props
}: DepartmentPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build departments from mapping
  const departments = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  const [peekedDepartment, setPeekedDepartment] = React.useState<
    ({ id: string } & T) | undefined
  >(departments[0] as ({ id: string } & T) | undefined);

  const handleSelect = (departmentId: string) => {
    const isSelected = selectedIds.includes(departmentId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== departmentId)
      : [...selectedIds, departmentId];
    onSelect(newIds);
    // Don't close popover in multi-select mode
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
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const dept = mapping[selectedIds[0]!];
      return dept?.name || placeholder;
    }
    return `${selectedIds.length} departments selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No departments found.`;
  };

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
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{department.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
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
                  {peekedDepartment?.name || "Department selected"}
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
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Departments">
                  {departments.map((department) => (
                    <DepartmentItem
                      key={department.id}
                      department={department as { id: string } & T}
                      isSelected={selectedIds.includes(department.id)}
                      onPeek={(dept) => setPeekedDepartment(dept)}
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
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">{department.name}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
