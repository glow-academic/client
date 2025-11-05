/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import Pricing from "@/components/pricing/Pricing";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Manage pricing for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function PricingPage() {
  // Get default filters matching analytics context (includes earliestAttemptDate logic)
  const filters = await getDefaultAnalyticsFilters();

  const queryClient = getQueryClient();

  // Prefetch pricing with same queryKey that client will use
  await queryClient.prefetchQuery({
    queryKey: keys.pricing.with(filters),
    queryFn: () => api.post("/pricing", { body: filters }),
    staleTime: 30_000, // Prevent instant refetch
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Pricing />
      </div>
    </HydrationBoundary>
  );
}
