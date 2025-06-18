/**
 * app/(main)/classes/c/[classId]/page.tsx
 * Edit page for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ClassEdit from "@/components/create/classes/ClassEdit";
import { use } from "react";

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
