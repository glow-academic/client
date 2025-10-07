/**
 * app/(main)/system/departments/d/[departmentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Department from "@/components/common/department/Department";
import { departmentRepo } from "@/lib/repos/departmentRepo";
import type { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { departmentId } = await params;
  const department = await departmentRepo.find(departmentId);
  return {
    title: `${department?.title || "Department"} Department`,
    description: `${department?.title + " " + department?.description || "Department"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
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
      <Department departmentId={departmentId} />
    </div>
  );
}
