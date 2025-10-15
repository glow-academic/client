/**
 * DepartmentsFilters.tsx
 * Department picker for analytics pages (superadmin only)
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { DepartmentSelector } from "@/components/common/analytics/DepartmentSelector";
import { useProfile } from "@/contexts/profile-context";
import { useState } from "react";

export function DepartmentsFilters() {
  // Local state for selected department IDs (filtering)
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  const { departments } = useProfile();

  // Convert departments to the format expected by DepartmentPicker
  const departmentOptions = departments.map((department) => ({
    id: department.id,
    title: department.title,
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
    <div className="pr-0">
      <div className="flex items-center gap-2">
        {/* Department Picker */}
        <DepartmentSelector
          departments={departmentOptions}
          selectedDepartments={selectedDepartments}
          onSelect={handleDepartmentSelect}
          placeholder="Departments"
          hideSelectedChips={true}
        />
      </div>
    </div>
  );
}
