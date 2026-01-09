/**
 * Departments.tsx
 * Resource component for department selection
 * Uses GenericPicker to select existing department resources
 * Manages department_ids array and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface DepartmentItem {
  id: string;
  name: string;
  description?: string;
}

export interface DepartmentsProps {
  department_ids?: string[]; // Current department resource IDs (standardized prop name)
  department_resources?: Array<{ department_id: string | null; name: string | null; description?: string | null; generated?: boolean }>; // Selected department resources (each includes generated field)
  show_departments?: boolean; // Whether to show this resource picker
  department_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  departments?: Array<{ department_id: string | null; name: string | null; description?: string | null; generated?: boolean }>; // All available departments from API (each includes generated field)
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
  const suggestionsList = department_suggestions ?? [];

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

  // Check if a department is suggested
  const isSuggested = useCallback(
    (departmentId: string) => suggestionsList.includes(departmentId),
    [suggestionsList]
  );

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
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
