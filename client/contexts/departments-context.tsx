/**
 * departments-context.tsx
 * Global context for department filtering
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { useProfile } from "@/contexts/profile-context";
import { useDepartments as useDepartmentsAPI } from "@/lib/api/hooks/departments";
import type { Department } from "@/lib/repos/departmentRepo";
import { log } from "@/utils/logger";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface DepartmentsContextType {
  // Department filtering state
  selectedDepartmentIds: string[];
  setSelectedDepartmentIds: (departmentIds: string[]) => void;

  // Utility functions
  clearDepartmentFilters: () => void;
  hasActiveDepartmentFilters: boolean;

  // Computed property that returns all department IDs when empty array means "all"
  effectiveDepartmentIds: string[];
}

const DepartmentsContext = createContext<DepartmentsContextType | undefined>(
  undefined
);

interface DepartmentsProviderProps {
  children: React.ReactNode;
}

export function DepartmentsProvider({ children }: DepartmentsProviderProps) {
  const { effectiveProfile } = useProfile();
  const { data: allDepartments = [] } = useDepartmentsAPI() as {
    data: Department[];
  };

  // Department filtering - empty array means all departments
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  // Initialize department selection based on user role
  useEffect(() => {
    if (effectiveProfile?.role === "superadmin") {
      // For superadmin, default to all departments (empty array means all)
      if (selectedDepartmentIds.length === 0) {
        // Don't set anything - empty array means all departments
        log.info("departments.initialization.superadmin", {
          message: "Superadmin user - showing all departments",
          context: { component: "DepartmentsProvider" },
        });
      }
    } else if (effectiveProfile?.departmentId) {
      // For non-superadmin users, default to their department only
      if (selectedDepartmentIds.length === 0) {
        setSelectedDepartmentIds([effectiveProfile.departmentId]);
        log.info("departments.initialization.user", {
          message: "Non-superadmin user - defaulting to their department",
          context: {
            component: "DepartmentsProvider",
            departmentId: effectiveProfile.departmentId,
          },
        });
      }
    }
  }, [
    effectiveProfile?.role,
    effectiveProfile?.departmentId,
    selectedDepartmentIds,
    setSelectedDepartmentIds,
  ]);

  const clearDepartmentFilters = useCallback(() => {
    setSelectedDepartmentIds([]);
  }, []);

  const hasActiveDepartmentFilters = selectedDepartmentIds.length > 0;

  // When selectedDepartmentIds is empty, return all department IDs
  const effectiveDepartmentIds = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return allDepartments.map((dept: Department) => dept.id);
    }
    return selectedDepartmentIds;
  }, [selectedDepartmentIds, allDepartments]);

  const value: DepartmentsContextType = useMemo(
    () => ({
      selectedDepartmentIds,
      setSelectedDepartmentIds,
      clearDepartmentFilters,
      hasActiveDepartmentFilters,
      effectiveDepartmentIds,
    }),
    [
      selectedDepartmentIds,
      setSelectedDepartmentIds,
      clearDepartmentFilters,
      hasActiveDepartmentFilters,
      effectiveDepartmentIds,
    ]
  );

  return (
    <DepartmentsContext.Provider value={value}>
      {children}
    </DepartmentsContext.Provider>
  );
}

export function useDepartments() {
  const context = useContext(DepartmentsContext);
  if (context === undefined) {
    throw new Error("useDepartments must be used within a DepartmentsProvider");
  }
  return context;
}
