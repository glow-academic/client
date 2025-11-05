/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Dashboard from "@/components/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/api/v3/dashboard", "post">;
type DashboardOut = OutputOf<"/api/v3/dashboard", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getDashboard = cache(
  async (input: DashboardIn): Promise<DashboardOut> => {
    return api.post("/dashboard", input);
  }
);

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Dashboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults
  const filters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Fetch dashboard data server-side
  const dashboardData = await getDashboard({
    body: filters,
  });

  return (
    <div className="space-y-6">
      <Dashboard dashboardData={dashboardData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DashboardIn, DashboardOut };
