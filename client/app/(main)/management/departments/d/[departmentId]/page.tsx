/**
 * app/(main)/management/departments/d/[departmentId]/page.tsx
 * Department edit page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import DepartmentEdit from "@/components/management/departments/DepartmentEdit";
import { use } from "react";

import { getDepartment } from "@/utils/queries/departments/get-department";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { departmentId } = await params;

  const department = await getDepartment(departmentId);

  return {
    title: `${department?.name}`,
    description: `Manage individual department in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = use(params);
  return (
    <div className="space-y-6">
      <DepartmentEdit departmentId={departmentId} />
    </div>
  );
}
