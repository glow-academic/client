/**
 * app/(main)/analytics/page.tsx
 * Analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Analytics",
    description:
      "Comprehensive learning analytics and performance metrics for teaching assistant training. Track simulation-based practice sessions, review pedagogical assessments, analyze teaching effectiveness, and monitor professional development progress.",
  };
}

export default function AnalyticsPage() {
  return redirect("/analytics/dashboard");
}
