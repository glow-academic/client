/**
 * app/(main)/analytics/page.tsx
 * Analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Analytics in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function AnalyticsPage() {
  return redirect("/analytics/dashboard");
}
