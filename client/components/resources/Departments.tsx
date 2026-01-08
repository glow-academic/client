/**
 * Departments.tsx
 * Resource component for department selection
 * Uses GenericPicker to select existing department resources
 * Manages department_ids array and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { useCallback, useMemo } from "react";

export interface DepartmentItem {
  id: string;
  name: string;
}

export interface DepartmentsProps {
  departmentIds: string[]; // Current department resource IDs from form state
  onChange: (ids: string[]) => void; // Update department_ids in form state
  validDepartmentIds: string[]; // Valid department IDs user can select
  departmentMapping: Record<string, DepartmentItem>; // Mapping of department_id -> {id, name}
  label?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  description?: string;
}

export function Departments({
  departmentIds,
  onChange,
  validDepartmentIds,
  departmentMapping,
  label = "Departments",
  disabled = false,
  id = "departments",
  placeholder = "Select departments...",
  description,
}: DepartmentsProps) {
  // Convert departmentMapping to array format for GenericPicker
  const departmentItems = useMemo(() => {
    return Object.values(departmentMapping).filter((dept) =>
      validDepartmentIds.includes(dept.id)
    );
  }, [departmentMapping, validDepartmentIds]);

  const handleSelect = useCallback(
    (ids: string[]) => {
      onChange(ids);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id}>
          {label}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <GenericPicker<DepartmentItem>
        items={departmentItems}
        itemIds={validDepartmentIds}
        selectedIds={departmentIds}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
