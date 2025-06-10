/**
 * app/(main)/classes/new/c/[classId]/page.tsx
 * Class details page for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ClassStatus from "@/components/management/classes/ClassStatus";
import { use } from "react";

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
