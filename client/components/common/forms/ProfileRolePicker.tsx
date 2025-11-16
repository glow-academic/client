/**
 * ProfileRolePicker.tsx
 * Multi-select role picker for ProfileRole (analytics and filters)
 * @AshokSaravanan222 & @siladiea
 * 08/11/2025
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

type ProfileRole = "superadmin" | "admin" | "instructional" | "ta" | "guest";

const PROFILE_ROLES: ProfileRole[] = [
  "superadmin",
  "admin",
  "instructional",
  "ta",
  "guest",
];

export interface ProfileRolePickerProps {
  roles?: ProfileRole[];
  selectedRoles?: ProfileRole[];
  onChange?: (roles: ProfileRole[]) => void;
  placeholder?: string;
  className?: string;
  hideSelectedChips?: boolean;
}

const ROLE_LABEL: Record<ProfileRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  instructional: "Instructional",
  ta: "Teaching Assistant",
  guest: "Guest",
};

export function ProfileRolePicker({
  roles = PROFILE_ROLES,
  selectedRoles = [],
  onChange,
  placeholder = "Select roles...",
  className,
  hideSelectedChips = true,
}: ProfileRolePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (role: ProfileRole) => {
    const isSelected = selectedRoles.includes(role);
    const updated = isSelected
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    onChange?.(updated);
  };

  const handleClear = () => {
    onChange?.([]);
    setOpen(false);
  };

  const getButtonText = () => {
    if (selectedRoles.length === 0) return placeholder;
    if (selectedRoles.length === 1) return ROLE_LABEL[selectedRoles[0]!];
    return `${selectedRoles.length} roles selected`;
  };

  return (
    <div className={className}>
      {selectedRoles.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedRoles.map((role) => (
            <div
              key={role}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
            >
              <span>{ROLE_LABEL[role]}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(selectedRoles.filter((r) => r !== role));
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
            aria-label="Select roles"
            className={cn("justify-between min-w-[75px]", className)}
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
              <CommandEmpty>No roles found.</CommandEmpty>
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
                {roles.map((role) => {
                  const isSelected = selectedRoles.includes(role);
                  return (
                    <CommandItem key={role} onSelect={() => handleSelect(role)}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {ROLE_LABEL[role]}
                        </div>
                        <Check
                          className={cn(
                            "ml-auto",
                            isSelected ? "opacity-100" : "opacity-0",
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
