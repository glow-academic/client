/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Dashboard from "@/components/analytics/Dashboard";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Dashboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Dashboard />
    </div>
  );
}
