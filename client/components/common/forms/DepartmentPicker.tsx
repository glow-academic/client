/**
 * DepartmentSelector.tsx
 * Single department selection component for forms - V2 (mapping-based)
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
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
import type { DepartmentMappingItem } from "@/lib/api/v2/schemas/personas";
import { cn } from "@/lib/utils";

export interface DepartmentSelectorProps extends PopoverProps {
  departmentMapping: Record<string, DepartmentMappingItem>;
  selectedDepartmentId: string;
  validDepartmentIds: string[];
  onSelect: (departmentId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface Department {
  id: string;
  name: string;
  description?: string | null;
}

export function DepartmentSelector({
  departmentMapping,
  selectedDepartmentId,
  validDepartmentIds,
  onSelect,
  placeholder = "Select department...",
  disabled = false,
  ...props
}: DepartmentSelectorProps) {
  const [open, setOpen] = React.useState(false);

  // Build departments from mapping
  const departments = React.useMemo(() => {
    return validDepartmentIds.map((id) => ({
      id,
      name: departmentMapping[id]?.name || id,
      description: departmentMapping[id]?.description ?? null,
    }));
  }, [validDepartmentIds, departmentMapping]);

  const selectedDepartment = React.useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((d) => d.id === selectedDepartmentId) || null;
  }, [selectedDepartmentId, departments]);

  const [peekedDepartment, setPeekedDepartment] = React.useState<
    Department | undefined
  >(departments[0]);

  const handleSelect = (department: Department) => {
    onSelect(department.id);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select department"
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate text-left">
              {selectedDepartment ? selectedDepartment.name : placeholder}
            </span>
            <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
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
                <CommandEmpty>No departments found.</CommandEmpty>
                <HoverCardTrigger />

                {selectedDepartment && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear selection
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Departments">
                  {departments.map((department) => (
                    <DepartmentItem
                      key={department.id}
                      department={department}
                      isSelected={selectedDepartment?.id === department.id}
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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{department.name}</div>
            {department.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
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
