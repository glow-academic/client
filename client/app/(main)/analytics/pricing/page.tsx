/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import { auth } from "@/auth";
import Pricing from "@/components/pricing/Pricing";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v3/pricing", "post">;
type PricingOut = OutputOf<"/api/v3/pricing", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getPricing = cache(async (input: PricingIn): Promise<PricingOut> => {
  return api.post("/pricing", input);
});

/** ---- Inline filters function for pricing page ---- */
const getPricingFilters = cache(async (searchParams?: URLSearchParams) => {
  const session = await auth();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await api.post("/profile/context", {
    body: {
      actualProfileId: session?.user?.profileId || "",
      effectiveProfileId: session?.effectiveProfileId || "",
      pathname: "/",
    },
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliestAttemptDate) {
    startDate = new Date(profileContext.earliestAttemptDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback to 30 days ago (matching analytics context)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const defaults = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [] as string[],
    roles: [] as string[],
    simulationFilters: ["general" as const],
    departmentIds: [] as string[],
  };

  // If search params are provided, merge them with defaults
  if (searchParams) {
    return searchParamsToFilters(searchParams, defaults);
  }

  return defaults;
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
  const filters = await getPricingFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
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
