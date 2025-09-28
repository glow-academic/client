/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ReportsPage from "@/components/analytics/report/ReportsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: `Reports in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ReportsFullPage() {
  return (
    <div className="space-y-6">
      <ReportsPage />
    </div>
  );
}
