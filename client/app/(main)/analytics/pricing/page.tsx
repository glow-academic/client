/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import { Suspense } from "react";

import { PricingRunsClient } from "@/components/artifacts/pricing/PricingRunsClient";
import { PricingSummary } from "@/components/artifacts/pricing/PricingSummary";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadPricingSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v4/artifacts/pricing/get", "post">;
type PricingOut = OutputOf<"/api/v4/artifacts/pricing/get", "post">;
type PricingRunsIn = InputOf<"/api/v4/artifacts/group/list", "post">;
type PricingRunsOut = OutputOf<"/api/v4/artifacts/group/list", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingAnalytics = async (input: PricingIn): Promise<PricingOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/pricing/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

const getPricingRuns = async (
  input: PricingRunsIn
): Promise<PricingRunsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/group/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pricing",
    description:
      "Manage pricing and subscription plans for GLOW teaching assistant training platform. Configure access levels, feature sets, and billing options for educational institutions and learning and development programs.",
  };
}

interface PricingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  // Parse search params via nuqs loader
  const q = loadPricingSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Fetch summary data server-side (for chart - all runs, no pagination)
  const pricingData = await getPricingAnalytics({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
      page_limit: 100,
      page_offset: 0,
      accessible_department_ids: profileContext.department_ids || [],
    },
  });

  // Pricing-specific params with defaults
  const pricingPage = q.pricingPage ?? 0;
  const pricingPageSize = q.pricingPageSize ?? 10;
  const pricingModelIds = q.pricingModelIds ?? undefined;
  const pricingSortBy = q.pricingSortBy ?? "date";
  const pricingSortOrder = q.pricingSortOrder ?? "desc";

  // Create runsKey for Suspense boundary
  const runsKey = [
    pricingPage,
    pricingPageSize,
    (pricingModelIds || []).join(","),
    pricingSortBy,
    pricingSortOrder,
    filters.startDate,
    filters.endDate,
  ].join("|");

  // Create empty runs data for loading state
  const emptyRunsData: PricingRunsOut = {
    items: [],
    total_count: 0,
  };

  return (
    <div className="space-y-6" data-page="pricing-index">
      <PricingSummary pricingData={pricingData} />

      <Suspense
        key={runsKey}
        fallback={
          <PricingRunsClient runsData={emptyRunsData} isLoading={true} />
        }
      >
        <PricingRunsSection
          filters={filters}
          pricingPage={pricingPage}
          pricingPageSize={pricingPageSize}
          pricingModelIds={pricingModelIds}
          pricingSortBy={pricingSortBy}
          pricingSortOrder={pricingSortOrder}
        />
      </Suspense>
    </div>
  );
}

/** ---- Inline runs section component (only used here) ---- */
async function PricingRunsSection({
  filters,
  pricingPage,
  pricingPageSize,
  pricingModelIds,
  pricingSortBy,
  pricingSortOrder,
}: {
  filters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
    simulationFilters: string[];
  };
  pricingPage: number;
  pricingPageSize: number;
  pricingModelIds?: string[] | undefined;
  pricingSortBy: string;
  pricingSortOrder: string;
}) {
  // Map frontend sort field to backend field name
  const sortBy = pricingSortBy === "createdAt" ? "date" : pricingSortBy;

  // Use first model ID if provided (endpoint accepts single model_id)
  const modelId = pricingModelIds?.[0] ?? null;

  const runsData = await getPricingRuns({
    body: {
      date_from: filters.startDate,
      date_to: filters.endDate,
      model_id: modelId,
      sort_by: sortBy,
      sort_order: pricingSortOrder,
      page_limit: pricingPageSize,
      page_offset: pricingPage * pricingPageSize,
    },
  });

  return <PricingRunsClient runsData={runsData} isLoading={false} />;
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut, PricingRunsIn, PricingRunsOut };
