/**
 * RubricEdit.tsx
 * Used to display the edit for the rubrics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Rubric from "@/components/common/rubric/Rubric";

export default function RubricEdit({ rubricId }: { rubricId: string }) {
  return <Rubric rubricId={rubricId} mode="edit" showAdvancedFeatures={true} />;
}
