/**
 * DepartmentEdit.tsx
 * Used to edit a department.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import Department from "@/components/common/department/Department";

export interface DepartmentEditProps {  
  departmentId: string;
}

export default function DepartmentEdit({ departmentId }: DepartmentEditProps) {
  return <Department departmentId={departmentId} />;
}