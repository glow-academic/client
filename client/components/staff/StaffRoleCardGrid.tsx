"use client";

import * as React from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAFF_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/staff-roles";

export interface StaffRoleCardGridProps {
  selectedRoleId: string;
  scopedRoles: string[];
  onRoleChange: (roleId: string) => void;
  readonly?: boolean;
}

export function StaffRoleCardGrid({
  selectedRoleId,
  scopedRoles,
  onRoleChange,
  readonly = false,
}: StaffRoleCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter roles by scoped roles and search term
  const filteredRoles = React.useMemo(() => {
    let roles = STAFF_ROLES.filter((role) => scopedRoles.includes(role.id));

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      roles = roles.filter(
        (role) =>
          role.name?.toLowerCase().includes(searchLower) ||
          role.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected role first, then by name
    return roles.sort((a, b) => {
      if (a.id === selectedRoleId) return -1;
      if (b.id === selectedRoleId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [scopedRoles, searchTerm, selectedRoleId]);

  const handleSelect = (roleId: string) => {
    if (readonly) return;
    onRoleChange(roleId);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search roles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
        {filteredRoles.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No roles found. Try adjusting your search.
          </div>
        ) : (
          filteredRoles.map((role) => {
            const isSelected = role.id === selectedRoleId;
            const IconComponent = role.icon;
            const hexColor = role.color || "#64748b";
            const gradientStyle = generateGradientFromHex(hexColor);

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelect(role.id)}
                disabled={readonly}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent",
                )}
              >
                {/* Check icon - top right */}
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
                      {role.name}
                    </h3>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {role.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
