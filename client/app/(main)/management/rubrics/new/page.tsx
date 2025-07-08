/**
 * app/management/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import NewRubric from "@/components/management/rubrics/NewRubric";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Rubric",
  description: "New rubric creation page using the unified rubric component in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewRubricPage() {
  return (
    <div className="space-y-6">
      <NewRubric />
    </div>
  );
}
