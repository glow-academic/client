/**
 * app/create/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import { use } from "react";
import RubricEdit from "@/components/create/rubrics/RubricEdit";

export default function EditRubricPage({
  params,
}: {
  params: Promise<{ rubricId: string }>;
}) {
  const { rubricId } = use(params);

  return (
    <div className="space-y-6">
      <RubricEdit rubricId={rubricId} />
    </div>
  );
}
