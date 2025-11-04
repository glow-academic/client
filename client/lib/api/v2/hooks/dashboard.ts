/**
 * Dashboard hooks for v2 API
 */

import { api } from "@/lib/api/v2/fetcher";
import { analyticsDashboardBundleKeys } from "@/lib/api/v2/keys";
import { AnalyticsFilters } from "@/lib/api/v2/schemas/base";
import { DashboardBundleResponseSchema } from "@/lib/api/v2/schemas/dashboard";
import { useQuery } from "@tanstack/react-query";

type DashboardHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useDashboard(
  filters: AnalyticsFilters,
  options: DashboardHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsDashboardBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/dashboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return DashboardBundleResponseSchema.parse(res);
    },
  });
}
