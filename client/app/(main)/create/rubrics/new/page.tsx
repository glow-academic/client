/**
 * app/create/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import NewRubric from "@/components/create/rubrics/NewRubric";

export default function NewRubricPage() {
  return (
    <div className="space-y-6">
      <NewRubric />
    </div>
  );

}
