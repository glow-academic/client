/**
 * Home hooks for v2 API
 */

import { api } from "@/lib/api/fetcher";
import { analyticsHomeOverviewKeys } from "@/lib/api/v2/keys";
import { AnalyticsFilters } from "@/lib/api/v2/schemas/base";
import { HomeOverviewResponseSchema } from "@/lib/api/v2/schemas/home";
import { useQuery } from "@tanstack/react-query";

type HomeHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useHome(
  filters: AnalyticsFilters,
  options: HomeHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsHomeOverviewKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/home", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return HomeOverviewResponseSchema.parse(res);
    },
  });
}

