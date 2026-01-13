/**
 * NewDepartment.tsx
 * Wrapper component for creating new departments
 * Follows PersonaNew.tsx pattern - separate component for compatibility
 */
"use client";

import Department from "./Department";
import type { DepartmentProps } from "./Department";

export interface NewDepartmentProps extends Omit<DepartmentProps, "departmentId"> {
  // No departmentId for new mode
}

export function NewDepartment(props: NewDepartmentProps) {
  return <Department {...props} />;
}

export default NewDepartment;
