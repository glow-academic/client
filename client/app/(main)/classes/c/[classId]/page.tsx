/**
 * app/(main)/classes/c/[classId]/page.tsx
 * Class details page for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import ClassDetails from "@/components/classes/ClassDetails";
import { use } from "react";

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  return (
    <div className="space-y-6">
      <ClassDetails classId={classId} />
    </div>
  );
}
