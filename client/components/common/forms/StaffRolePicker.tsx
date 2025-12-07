/**
 * StaffRolePicker.tsx
 * Used to pick staff roles with descriptions
 * Follows Persona.tsx picker patterns
 * @AshokSaravanan222
 * 01/21/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Crown,
  GraduationCap,
  Shield,
  User,
} from "lucide-react";
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

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Staff role definitions with descriptions, icons, and colors
export const STAFF_ROLES = [
  {
    id: "superadmin",
    name: "Super Administrator",
    description: "Full system access to all data and permissions",
    icon: Crown,
    color: "#f59e0b", // amber
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Read access to all data except system information",
    icon: Shield,
    color: "#3b82f6", // blue
  },
  {
    id: "instructional",
    name: "Instructional Staff",
    description:
      "Manages GTAs, has access to analytics, create, and cohorts sections",
    icon: GraduationCap,
    color: "#8b5cf6", // purple
  },
  {
    id: "ta",
    name: "Teaching Assistant",
    description: "Graduate Teaching Assistant (GTA) trainee role",
    icon: BookOpen,
    color: "#10b981", // green
  },
  {
    id: "guest",
    name: "Guest",
    description: "Limited access, not logged in or not registered",
    icon: User,
    color: "#6b7280", // gray
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

  const selectedRoleData = React.useMemo(() => {
    return STAFF_ROLES.find((r) => r.id === selectedRole);
  }, [selectedRole]);

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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedRoleData && (
              <div
                className="p-1 rounded-md shadow-sm flex-shrink-0"
                style={{
                  background: generateGradientFromHex(
                    selectedRoleData.color || "#64748b",
                  ),
                }}
              >
                {(() => {
                  const IconComponent = selectedRoleData.icon || User;
                  return <IconComponent className="h-3.5 w-3.5 text-white" />;
                })()}
              </div>
            )}
            <span className="truncate">{getButtonText()}</span>
          </div>
          <ChevronsUpDown className="opacity-50 ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search roles..." />
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup heading="Staff Roles">
              {availableRoles.map((role) => {
                const IconComponent = role.icon || User;
                const hexColor = role.color || "#64748b";
                const gradientStyle = generateGradientFromHex(hexColor);

                return (
                  <CommandItem
                    key={role.id}
                    onSelect={() => handleSelect(role.id)}
                    className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div
                        className="p-2 rounded-lg shadow-lg flex-shrink-0"
                        style={{
                          background: gradientStyle,
                        }}
                      >
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{role.name}</div>
                        {role.description && (
                          <div className="text-sm text-muted-foreground truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto",
                          selectedRole === role.id
                            ? "opacity-100"
                            : "opacity-0",
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
  );
}
