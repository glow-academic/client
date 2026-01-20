/**
 * Roles.tsx
 * Resource component for role selection
 * Uses SelectableGrid for grid card layout (like Cohorts.tsx)
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import {
  STAFF_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/staff-roles";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useMemo } from "react";

export interface RolesProps {
  role?: string | null;
  role_options?: string[];
  show_roles?: boolean;
  disabled?: boolean;
  onRoleChange: (roleId: string) => void;
  label?: string;
  id?: string;
  required?: boolean;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  emptyMessage?: string;
}

export function Roles({
  role,
  role_options,
  show_roles = true,
  disabled = false,
  onRoleChange,
  label = "Role",
  id = "role",
  required = true,
  searchTerm = "",
  showSelectedFilter = false,
  emptyMessage = "No roles found. Try adjusting your search.",
}: RolesProps) {
  const availableRoles = useMemo(() => {
    if (!role_options || role_options.length === 0) {
      return STAFF_ROLES;
    }
    return STAFF_ROLES.filter((r) => role_options.includes(r.id));
  }, [role_options]);

  const filteredRoles = useMemo(() => {
    let roles = availableRoles;
    const trimmedSearch = searchTerm.trim().toLowerCase();

    if (trimmedSearch) {
      roles = roles.filter(
        (r) =>
          r.name.toLowerCase().includes(trimmedSearch) ||
          r.description.toLowerCase().includes(trimmedSearch) ||
          r.id.toLowerCase().includes(trimmedSearch)
      );
    }

    if (showSelectedFilter && role) {
      roles = roles.filter((r) => r.id === role);
    }

    return [...roles].sort((a, b) => {
      if (a.id === role) return -1;
      if (b.id === role) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [availableRoles, searchTerm, showSelectedFilter, role]);

  if (!show_roles) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <SelectableGrid
        items={filteredRoles}
        selectedId={role ?? null}
        onSelect={(roleId) => onRoleChange(roleId)}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const IconComponent = item.icon;
          const gradientStyle = generateGradientFromHex(item.color);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shadow-sm flex-shrink-0"
                  style={{ background: gradientStyle }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage={emptyMessage}
        disabled={disabled}
      />
    </div>
  );
}
