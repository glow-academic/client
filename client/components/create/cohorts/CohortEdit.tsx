/**
 * CohortEdit.tsx
 * Used to display the edit cohort page.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import Cohort from "@/components/common/cohort/Cohort";

export interface CohortEditProps {
  cohortId: string;
}

export default function CohortEdit({
  cohortId,
}: CohortEditProps) {
  return <Cohort cohortId={cohortId} />;
}
