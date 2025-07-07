/**
 * app/(main)/analytics/reports/p/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Reports in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ReportsPage() {
  return redirect("/analytics/reports");
}
