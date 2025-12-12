/**
 * app/(main)/analytics/reports/p/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Reports",
    description:
      "Comprehensive assessment reports and evaluation data for teaching assistant training. Generate detailed performance analytics, pedagogical assessment summaries, and learning progress reports to track teaching effectiveness and professional development.",
  };
}

export default function ReportsPage() {
  return redirect("/analytics/reports");
}
