"use client";

import * as React from "react";
import { Search, Check, CheckCircle2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DepartmentItem {
  department_id: string;
  name: string;
  description: string;
}

export interface StaffDepartmentCardGridProps {
  departmentIds: string[];
  primaryDepartmentId: string | undefined;
  validDepartmentIds: string[];
  departments: DepartmentItem[];  // Array of department objects (replaces departmentMapping)
  onDepartmentIdsChange: (ids: string[]) => void;
  onPrimaryDepartmentIdChange: (id: string | undefined) => void;
  readonly?: boolean;
}

export function StaffDepartmentCardGrid({
  departmentIds,
  primaryDepartmentId,
  validDepartmentIds,
  departments,
  onDepartmentIdsChange,
  onPrimaryDepartmentIdChange,
  readonly = false,
}: StaffDepartmentCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build departments from array, filtered by validDepartmentIds
  const baseDepartments = React.useMemo(() => {
    const deptMap = new Map(departments.map((d) => [d.department_id, d]));
    const validDepartments = validDepartmentIds
      .map((id) => {
        const dept = deptMap.get(id);
        if (dept) {
          return {
            id: dept.department_id,
            name: dept.name || "",
            description: dept.description || "",
          };
        }
        return null;
      })
      .filter((d): d is { id: string; name: string; description: string } => d !== null);

    // Sort by name
    return validDepartments.sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [validDepartmentIds, departments]);

  // Apply search filter, then sort selected first
  const filteredDepartments = React.useMemo(() => {
    let filtered = baseDepartments;

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (dept) =>
          dept.name?.toLowerCase().includes(searchLower) ||
          dept.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected departments first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = departmentIds.includes(a.id);
      const bSelected = departmentIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (aSelected && bSelected) {
        // Both selected - preserve order from departmentIds array
        const aIndex = departmentIds.indexOf(a.id);
        const bIndex = departmentIds.indexOf(b.id);
        return aIndex - bIndex;
      }
      // Both unselected - sort by name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseDepartments, searchTerm, departmentIds]);

  const handleSelect = (departmentId: string) => {
    if (readonly) return;
    const isSelected = departmentIds.includes(departmentId);
    const newIds = isSelected
      ? departmentIds.filter((id) => id !== departmentId)
      : [...departmentIds, departmentId];

    onDepartmentIdsChange(newIds);

    // If removing primary department, clear it
    if (isSelected && departmentId === primaryDepartmentId) {
      const remainingIds = newIds.filter((id) => id !== departmentId);
      onPrimaryDepartmentIdChange(
        remainingIds.length > 0 ? remainingIds[0] : undefined,
      );
    }
  };

  const handleSetPrimary = (departmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readonly) return;
    if (departmentIds.includes(departmentId)) {
      onPrimaryDepartmentIdChange(departmentId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
        {filteredDepartments.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No departments found. Try adjusting your search.
          </div>
        ) : (
          filteredDepartments.map((dept) => {
            const isSelected = departmentIds.includes(dept.id);
            const isPrimary = dept.id === primaryDepartmentId;

            return (
              <div
                key={dept.id}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all cursor-pointer",
                  "hover:shadow-md hover:bg-accent/50",
                  isSelected && "ring-2 ring-primary bg-accent",
                )}
                onClick={() => handleSelect(dept.id)}
              >
                {/* Check icon - top right */}
                {isSelected && (
                  <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}

                {/* Primary Badge */}
                {isPrimary && (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Primary
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight">
                      {dept.name || "Unnamed Department"}
                    </h3>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {dept.description}
                      </p>
                    )}
                    {isSelected && !isPrimary && (
                      <button
                        type="button"
                        onClick={(e) => handleSetPrimary(dept.id, e)}
                        disabled={readonly}
                        className="mt-2 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
