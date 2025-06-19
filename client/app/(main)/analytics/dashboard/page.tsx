/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Dashboard from "@/components/analytics/Dashboard";
import { DashboardProvider } from "@/contexts/dashboard-context";

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="space-y-6">
        <Dashboard />
      </div>
    </DashboardProvider>
  );
}
