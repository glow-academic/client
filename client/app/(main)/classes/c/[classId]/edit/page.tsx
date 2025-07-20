/**
 * app/(main)/classes/c/[classId]/edit/page.tsx
 * Edit page for the class page.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import ClassEdit from "@/components/classes/ClassEdit";
import { use } from "react";

import { getClass } from "@/utils/queries/classes/get-class";
import { getDepartment } from "@/utils/queries/departments/get-department";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ classId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { classId } = await params;
  const classData = await getClass(classId);
  const department = await getDepartment(classData!.departmentId!);
  return {
    title: `${classData && department ? `${department.departmentCode}-${classData.classCode}` : "Class"}`,
    description: `${classData?.name + " " + classData?.classCode + " " + classData?.description || "Class"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function ClassEditPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  return (
    <div className="space-y-6">
      <ClassEdit classId={classId} />
    </div>
  );
}
