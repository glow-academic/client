/**
 * app/a/page.tsx
 * Attempts page. Redirects to new attempt page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Practice Attempts",
    description:
      "View and manage simulation-based practice sessions for teaching assistant training. Track practice attempts, review pedagogical performance, and monitor progress in student interaction and teaching effectiveness.",
  };
}

export default function PracticeAttemptsPage() {
  return redirect("/practice");
}
