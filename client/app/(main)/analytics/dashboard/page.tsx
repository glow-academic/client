/**
 * app/(main)/analytics/dashboard/page.tsx
 * Dashboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */


import Dashboard from "@/components/dashboard/Dashboard";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: `Dashboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function DashboardPage() {
  // Get default filters matching analytics context (includes earliestAttemptDate logic)
  const filters = await getDefaultAnalyticsFilters();

  const queryClient = getQueryClient();

  // Prefetch dashboard with same queryKey that client will use
  await queryClient.prefetchQuery({
    queryKey: keys.dashboard.with(filters),
    queryFn: () => api.post("/dashboard", { body: filters }),
    staleTime: 30_000, // Prevent instant refetch
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Dashboard />
      </div>
    </HydrationBoundary>
  );
}
