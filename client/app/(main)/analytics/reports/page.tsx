/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ReportsPage from "@/components/reports/ReportsPage";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: `Reports in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function ReportsFullPage() {
  // Get default filters matching analytics context (includes earliestAttemptDate logic)
  const filters = await getDefaultAnalyticsFilters();

  const queryClient = getQueryClient();

  // Prefetch reports with same queryKey that client will use
  await queryClient.prefetchQuery({
    queryKey: keys.reports.with(filters),
    queryFn: () => api.post("/reports", { body: filters }),
    staleTime: 30_000, // Prevent instant refetch
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ReportsPage />
      </div>
    </HydrationBoundary>
  );
}
