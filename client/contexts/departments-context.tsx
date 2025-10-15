"use client";

import { useProfile } from "@/contexts/profile-context";
import { createContext, useContext } from "react";

interface DepartmentsContextType {
  effectiveDepartmentIds: string[];
}

const DepartmentsContext = createContext<DepartmentsContextType | undefined>(
  undefined
);

export function useDepartments(): DepartmentsContextType {
  const context = useContext(DepartmentsContext);
  const profileContext = useProfile();

  if (context) {
    return context;
  }

  // Derive from profile context (which includes departmentIds from layout data)
  const effectiveDepartmentIds = profileContext.departmentIds || [];

  return {
    effectiveDepartmentIds,
  };
}
