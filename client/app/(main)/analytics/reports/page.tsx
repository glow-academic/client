/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import Reports from "@/components/analytics/report/Reports";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Reports in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <Reports />
    </div>
  );
}
