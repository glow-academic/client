/**
 * CohortEdit.tsx
 * Used to display the edit cohort page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Cohort from "@/components/common/cohort/Cohort";

export default function CohortEdit({
  cohortId,
}: {
  cohortId: string;
}) {
  return <Cohort cohortId={cohortId} />;
}
