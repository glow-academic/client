/**
 * Pricing hooks for v2 API
 */

import { api } from "@/lib/api/v2/fetcher";
import { analyticsPricingKeys } from "@/lib/api/v2/keys";
import { AnalyticsFilters } from "@/lib/api/v2/schemas/base";
import { PricingAnalyticsResponseSchema } from "@/lib/api/v2/schemas/pricing";
import { useQuery } from "@tanstack/react-query";

type PricingHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function usePricing(
  filters: AnalyticsFilters,
  options: PricingHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: analyticsPricingKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/pricing", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PricingAnalyticsResponseSchema.parse(res);
    },
  });
}
