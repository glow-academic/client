/**
 * app/(main)/classes/new/c/[classId]/page.tsx
 * Class details page for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ClassStatus from "@/components/create/classes/ClassStatus";
import { use } from "react";

import type { Metadata, ResolvingMetadata } from "next";
import { getClass } from "@/utils/queries/classes/get-class";


export async function generateMetadata(
  { params }: { params: Promise<{ classId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { classId } = await params;
  const classData = await getClass(classId);
  return {
    title: `${classData?.name || "Class"} Status`,
    description: `${classData?.name + " " + classData?.description || "Class"} status in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}





export default function ClassStatusPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  return (
    <div className="space-y-6">
      <ClassStatus classId={classId} />
    </div>
  );
}
