/**
 * Leaderboard hooks for v2 API
 */

import { api } from "@/lib/api/v2/fetcher";
import { analyticsLeaderboardBundleKeys } from "@/lib/api/v2/keys";
import { AnalyticsFilters } from "@/lib/api/v2/schemas/base";
import { LeaderboardBundleResponseSchema } from "@/lib/api/v2/schemas/leaderboard";
import { useQuery } from "@tanstack/react-query";

type LeaderboardHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useLeaderboard(
  filters: AnalyticsFilters,
  options: LeaderboardHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean" ? { enabled: options } : options;

  return useQuery({
    queryKey: analyticsLeaderboardBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/leaderboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return LeaderboardBundleResponseSchema.parse(res);
    },
  });
}
