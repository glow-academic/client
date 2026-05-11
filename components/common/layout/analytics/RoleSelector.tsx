/**
 * RoleSelector.tsx
 * Used to pick roles for filtering analytics
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

export interface RoleOption {
  id: string;
  label: string;
  description?: string | null;
  iconId?: string | null;
  colorId?: string | null;
  level?: number;
}

export interface RoleSelectorProps extends PopoverProps {
  roles: RoleOption[];
  placeholder?: string;
  onSelect?: (roles: string[]) => void;
  selectedRoles?: string[];
  hideSelectedChips?: boolean;
}

export function RoleSelector({
  roles,
  placeholder = "Roles",
  onSelect,
  selectedRoles = [],
  hideSelectedChips = true,
  ...props
}: RoleSelectorProps) {
  const labelById = React.useMemo(
    () => new Map(roles.map((role) => [role.id, role.label])),
    [roles],
  );
  const getLabel = (roleId: string) => labelById.get(roleId) ?? roleId;
  const [open, setOpen] = React.useState(false);

  const handleSelect = (roleId: string) => {
    const isSelected = selectedRoles.includes(roleId);
    let newSelectedRoles: string[];

    if (isSelected) {
      // Remove from selection
      newSelectedRoles = selectedRoles.filter((r) => r !== roleId);
    } else {
      // Add to selection
      newSelectedRoles = [...selectedRoles, roleId];
    }

    onSelect?.(newSelectedRoles);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect?.([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (
    roleToRemove: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const newSelectedRoles = selectedRoles.filter((r) => r !== roleToRemove);
    onSelect?.(newSelectedRoles);
  };

  const getButtonText = () => {
    if (selectedRoles.length === 0) {
      return placeholder;
    }
    if (selectedRoles.length === 1) {
      return getLabel(selectedRoles[0]!);
    }
    return `${selectedRoles.length} roles selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No roles found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedRoles.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedRoles.map((role) => (
            <div
              key={role}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{getLabel(role)}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveItem(role, e)}
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
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select roles"
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
              <CommandInput placeholder="Search roles..." />
              <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
              {selectedRoles.length > 0 && (
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    Clear All
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Roles">
                {roles.map((role) => (
                  <RoleItem
                    key={role.id}
                    role={role.id}
                    label={role.label}
                    isSelected={selectedRoles.includes(role.id)}
                    onSelect={() => handleSelect(role.id)}
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

interface RoleItemProps {
  role: string;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

function RoleItem({ role, label, isSelected, onSelect }: RoleItemProps) {
  return (
    <CommandItem key={role} onSelect={onSelect}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">{label}</div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
