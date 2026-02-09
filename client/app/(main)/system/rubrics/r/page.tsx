/**
 * app/(main)/system/rubrics/r/page.tsx
 * Rubric page for the rubrics section. Redirects to rubrics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Rubrics",
    description:
      "Manage assessment rubrics for teaching assistant evaluation. Create and customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
  };
}

export default function RubricsPage() {
  return redirect("/system/rubrics");
}
