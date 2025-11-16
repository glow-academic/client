/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Dashboard from "@/components/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DashboardIn = InputOf<"/api/v3/dashboard", "post">;
type DashboardOut = OutputOf<"/api/v3/dashboard", "post">;
type BulkArchiveAttemptsIn = InputOf<"/api/v3/attempts/bulk-archive", "post">;
type BulkArchiveAttemptsOut = OutputOf<"/api/v3/attempts/bulk-archive", "post">;

/** ---- Inline filters function for dashboard page ---- */
async function getDashboardFilters(searchParams?: URLSearchParams) {
  const session = await getSession();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await api.post("/profile/context", {
    body: {
      actualProfileId: session?.user?.profileId || "",
      effectiveProfileId: session?.effectiveProfileId || "",
      pathname: "/",
    },
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliestAttemptDate) {
    startDate = new Date(profileContext.earliestAttemptDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback to 30 days ago (matching analytics context)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const defaults = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [] as string[],
    roles: [] as string[],
    simulationFilters: ["general" as const],
    departmentIds: [] as string[],
  };

  // If search params are provided, merge them with defaults
  if (searchParams) {
    return searchParamsToFilters(searchParams, defaults);
  }

  return defaults;
}

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
  const session = await getSession();

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
  const filters = await getDashboardFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Add historyProfileId from session to request body (not search params)
  // profileId is left null for main dashboard metrics (not used for filtering)
  // historyProfileId is used only for history showRetry calculation
  const dashboardRequestBody = {
    ...filters,
    profileId: null, // Not used for main dashboard metrics
    ...(session?.effectiveProfileId && {
      historyProfileId: session.effectiveProfileId,
    }),
  };

  // Fetch dashboard data server-side
  const dashboardData = await api.post("/dashboard", {
    body: dashboardRequestBody,
  });

  return (
    <div className="space-y-6" data-page="dashboard-index">
      <Dashboard
        dashboardData={dashboardData}
        bulkArchiveAttemptsAction={bulkArchiveAttempts}
      />
    </div>
  );
}

/** ---- Strongly-typed server actions for Dashboard (single source of truth) ---- */
export async function bulkArchiveAttempts(
  input: BulkArchiveAttemptsIn
): Promise<BulkArchiveAttemptsOut> {
  "use server";
  return api.post("/attempts/bulk-archive", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkArchiveAttemptsIn,
  BulkArchiveAttemptsOut,
  DashboardIn,
  DashboardOut,
};
