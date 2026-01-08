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
  description?: string;
}

export interface DepartmentsProps {
  department_ids?: string[]; // Current department resource IDs (standardized prop name)
  department_resources?: Array<{ department_id: string | null; name: string | null; description?: string | null }>; // Selected department resources
  show_departments?: boolean; // Whether to show this resource picker
  department_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  departments?: Array<{ department_id: string | null; name: string | null; description?: string | null }>; // All available departments from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update department_ids in form state
  label?: string;
  id?: string;
  placeholder?: string;
  description?: string;
  // Legacy props for backward compatibility
  departmentIds?: string[];
}

export function Departments({
  department_ids,
  department_resources,
  show_departments = false,
  department_suggestions,
  departments,
  disabled = false,
  onChange,
  label = "Departments",
  id = "departments",
  placeholder = "Select departments...",
  description,
  // Legacy props for backward compatibility
  departmentIds,
}: DepartmentsProps) {
  // Use standardized props with fallback to legacy props
  const ids = department_ids ?? departmentIds ?? [];
  const show = show_departments ?? false;
  const allDepartments = departments ?? [];

  // Don't render if show_departments is false
  if (!show) {
    return null;
  }

  // Convert departments array to DepartmentItem format for GenericPicker
  const departmentItems = useMemo(() => {
    return allDepartments
      .filter((d) => d.department_id && d.name) // Filter out nulls
      .map((d) => ({
        id: d.department_id!,
        name: d.name!,
        description: d.description ?? undefined,
      }));
  }, [allDepartments]);

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
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
        itemIds={allDepartments.map((d) => d.department_id)} // All department IDs from array
        selectedIds={ids}
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
