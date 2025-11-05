/**
 * app/(main)/analytics/leaderboard/page.tsx
 * Leaderboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Leaderboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function LeaderboardPage() {
  // Get default filters matching analytics context (includes earliestAttemptDate logic)
  const filters = await getDefaultAnalyticsFilters();

  const queryClient = getQueryClient();

  // Prefetch leaderboard with same queryKey that client will use
  await queryClient.prefetchQuery({
    queryKey: keys.leaderboard.with(filters),
    queryFn: () => api.post("/leaderboard", { body: filters }),
    staleTime: 30_000, // Prevent instant refetch
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Leaderboard />
      </div>
    </HydrationBoundary>
  );
}
