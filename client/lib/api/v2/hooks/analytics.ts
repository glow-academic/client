/**
 * Analytics utility hooks for v2 API
 * Only contains refresh functionality - all analytics data is now in separate hooks:
 * - dashboard.ts
 * - home.ts
 * - practice.ts
 * - leaderboard.ts
 * - reports.ts
 * - pricing.ts
 */

import { api } from "@/lib/api/v2/fetcher";
import { analyticsRefreshKeys } from "@/lib/api/v2/keys";
import { RefreshResponseSchema } from "@/lib/api/v2/schemas/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useRefreshAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: analyticsRefreshKeys.all,
    mutationFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const res = await api<unknown>("/api/v2/analytics/refresh", {
          method: "POST",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return RefreshResponseSchema.parse(res);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all v2 analytics queries to refresh the data
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("analytics:v2:");
        },
      });
    },
    retry: false,
    networkMode: "online",
    gcTime: 0,
    meta: {
      errorMessage: "Failed to refresh analytics data",
    },
  });
}
