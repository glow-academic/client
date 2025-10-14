/**
 * RubricEdit.tsx
 * Used to display the edit for the rubrics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Rubric from "@/components/common/rubric/Rubric";

export interface RubricEditProps {
  rubricId: string;
}

export default function RubricEdit({ rubricId }: RubricEditProps) {
  return <Rubric rubricId={rubricId} />;
}
