/**
 * app/(main)/analytics/dashboard/edit/page.tsx
 * Dashboard edit page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */



import DashboardEdit from "@/components/common/dashboard/DashboardEdit";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Edit",
  description: "Dashboard edit in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function DashboardEditPage() {
  return (
    <div className="space-y-6">
      <DashboardEdit />
    </div>
  );
}
