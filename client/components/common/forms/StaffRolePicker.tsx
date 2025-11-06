/**
 * StaffRolePicker.tsx
 * Used to pick staff roles with descriptions
 * Follows Persona.tsx picker patterns
 * @AshokSaravanan222
 * 01/21/2025
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Staff role definitions with descriptions
export const STAFF_ROLES = [
  {
    id: "superadmin",
    name: "Super Administrator",
    description: "Full system access to all data and permissions",
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Read access to all data except system information",
  },
  {
    id: "instructional",
    name: "Instructional Staff",
    description:
      "Manages GTAs, has access to analytics, create, and cohorts sections",
  },
  {
    id: "ta",
    name: "Teaching Assistant",
    description: "Graduate Teaching Assistant (GTA) trainee role",
  },
  {
    id: "guest",
    name: "Guest",
    description: "Limited access, not logged in or not registered",
  },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]["id"];

export interface StaffRolePickerProps extends PopoverProps {
  selectedRole: string;
  onSelect: (role: string) => void;
  roleOptions?: string[]; // Filter available roles (from API)
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function StaffRolePicker({
  selectedRole,
  onSelect,
  roleOptions,
  placeholder = "Select role...",
  disabled = false,
  buttonClassName,
  ...props
}: StaffRolePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Filter roles based on roleOptions if provided
  const availableRoles = React.useMemo(() => {
    if (!roleOptions || roleOptions.length === 0) {
      return STAFF_ROLES;
    }
    return STAFF_ROLES.filter((role) => roleOptions.includes(role.id));
  }, [roleOptions]);

  const handleSelect = (roleId: string) => {
    onSelect(roleId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedRole) {
      return placeholder;
    }
    const role = STAFF_ROLES.find((r) => r.id === selectedRole);
    return role?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select staff role"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search roles..." />
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup heading="Staff Roles">
              {availableRoles.map((role) => (
                <CommandItem
                  key={role.id}
                  onSelect={() => handleSelect(role.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedRole === role.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
