/**
 * Practice hooks for v2 API
 */

import { api } from "@/lib/api/fetcher";
import { analyticsPracticeOverviewKeys } from "@/lib/api/v2/keys";
import {
  PracticeFilters,
  PracticeOverviewResponseSchema,
} from "@/lib/api/v2/schemas/practice";
import { useQuery } from "@tanstack/react-query";

type PracticeHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function usePractice(
  filters: PracticeFilters,
  options: PracticeHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPracticeOverviewKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/practice", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PracticeOverviewResponseSchema.parse(res);
    },
  });
}
