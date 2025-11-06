/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import Pricing from "@/components/pricing/Pricing";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v3/pricing", "post">;
type PricingOut = OutputOf<"/api/v3/pricing", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getPricing = cache(async (input: PricingIn): Promise<PricingOut> => {
  return api.post("/pricing", input);
});

export const metadata: Metadata = {
  title: "Pricing",
  description: `Manage pricing for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface PricingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults
  const filters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined,
  );

  // Fetch pricing data server-side
  const pricingData = await getPricing({
    body: filters,
  });

  return (
    <div className="space-y-6">
      <Pricing pricingData={pricingData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut };
