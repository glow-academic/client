/**
 * DepartmentsFilters.tsx
 * Department picker for analytics pages (superadmin only)
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { DepartmentPicker } from "@/components/common/analytics/DepartmentPicker";
import { useDepartments as useDepartmentsContext } from "@/contexts/departments-context";
import { useDepartments } from "@/lib/api/hooks/departments";

export function DepartmentsFilters() {
  const { selectedDepartmentIds, setSelectedDepartmentIds } =
    useDepartmentsContext();

  const { data: departments = [] } = useDepartments();

  // Convert departments to the format expected by DepartmentPicker
  const departmentOptions = departments.map((department) => ({
    id: department.id,
    title: department.title as string,
    ...(department.description && { description: department.description }),
  }));

  // Get selected departments for the picker
  const selectedDepartments = departmentOptions.filter((department) =>
    selectedDepartmentIds.includes(department.id)
  );

  const handleDepartmentSelect = (departments: typeof departmentOptions) => {
    setSelectedDepartmentIds(departments.map((d) => d.id));
  };

  return (
    <div className="px-4">
      <div className="flex items-center gap-2">
        {/* Department Picker */}
        <DepartmentPicker
          departments={departmentOptions}
          selectedDepartments={selectedDepartments}
          onSelect={handleDepartmentSelect}
          placeholder="All departments"
          hideSelectedChips={true}
        />
      </div>
    </div>
  );
}
