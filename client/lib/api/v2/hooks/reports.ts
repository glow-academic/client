/**
 * Reports hooks for v2 API
 */

import { api } from "@/lib/api/v2/fetcher";
import { analyticsReportsBundleKeys } from "@/lib/api/v2/keys";
import { AnalyticsFilters } from "@/lib/api/v2/schemas/base";
import { ReportsBundleResponseSchema } from "@/lib/api/v2/schemas/reports";
import { useQuery } from "@tanstack/react-query";

type ReportsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useReports(
  filters: AnalyticsFilters,
  options: ReportsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsReportsBundleKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/reports", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ReportsBundleResponseSchema.parse(res);
    },
  });
}
