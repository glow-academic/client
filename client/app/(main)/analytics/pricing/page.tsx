/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import { Suspense } from "react";

import { PricingRunsClient } from "@/components/pricing/PricingRunsClient";
import { PricingSummary } from "@/components/pricing/PricingSummary";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { getLayoutContext } from "../../layout-server";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v4/analytics/pricing/get", "post">;
type PricingOut = OutputOf<"/api/v4/analytics/pricing/get", "post">;
type PricingRunsIn = InputOf<"/api/v4/analytics/pricing/list", "post">;
type PricingRunsOut = OutputOf<"/api/v4/analytics/pricing/list", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Pricing analytics responses can get large and exceed Next.js 2MB cache limit (~9MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPricingAnalytics = async (input: PricingIn): Promise<PricingOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/pricing/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch (no Next.js cache) ----
 * Pricing runs responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPricingRuns = async (
  input: PricingRunsIn
): Promise<PricingRunsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/pricing/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Inline filters function for pricing page ---- */
async function getPricingFilters(
  searchParams?: URLSearchParams,
) {
  // Use cached layout context (reuses data already fetched by layout)
  const profileContext = await getLayoutContext({
    body: {},
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliest_attempt_date) {
    startDate = new Date(profileContext.earliest_attempt_date);
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
  let filters = defaults;
  if (searchParams) {
    const parsedFilters = searchParamsToFilters(searchParams, defaults);
    filters = {
      startDate: parsedFilters.startDate || defaults.startDate,
      endDate: parsedFilters.endDate || defaults.endDate,
      cohortIds: parsedFilters.cohortIds || defaults.cohortIds,
      roles: parsedFilters.roles || defaults.roles,
      simulationFilters: (parsedFilters.simulationFilters ||
        defaults.simulationFilters) as typeof defaults.simulationFilters,
      departmentIds: parsedFilters.departmentIds || defaults.departmentIds,
    };
  }

  // Always use non-empty arrays: if selected filters are empty, use all IDs from profile context
  const cohortIds =
    filters.cohortIds && filters.cohortIds.length > 0
      ? filters.cohortIds
      : profileContext.cohort_ids || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.department_ids || [];
  const roles =
    filters.roles && filters.roles.length > 0
      ? filters.roles
      : profileContext.scoped_roles || [];

  return {
    ...filters,
    cohortIds,
    departmentIds,
    roles,
  };
}

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
  // Access control is handled server-side in layout
  // Get profile IDs from session

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

  // Fetch summary data server-side (for chart - all runs, no pagination)
  // Convert camelCase to snake_case for API
  const pricingData = await getPricingAnalytics({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      cohort_ids: filters.cohortIds,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      simulation_filters: filters.simulationFilters,
    },
  });

  // Extract pagination and filter params from search params for runs table
  const pricingPage = searchParamsObj.get("pricingPage")
    ? parseInt(searchParamsObj.get("pricingPage") || "0", 10)
    : 0;
  const pricingPageSize = searchParamsObj.get("pricingPageSize")
    ? parseInt(searchParamsObj.get("pricingPageSize") || "10", 10)
    : 10;
  const pricingSearch = searchParamsObj.get("pricingSearch") || undefined;
  const pricingModelIds = searchParamsObj.get("pricingModelIds")
    ? searchParamsObj.get("pricingModelIds")?.split(",").filter(Boolean)
    : undefined;
  const pricingProfileIds = searchParamsObj.get("pricingProfileIds")
    ? searchParamsObj.get("pricingProfileIds")?.split(",").filter(Boolean)
    : undefined;
  const pricingActorIds = searchParamsObj.get("pricingActorIds")
    ? searchParamsObj.get("pricingActorIds")?.split(",").filter(Boolean)
    : undefined;
  const pricingSortBy = searchParamsObj.get("pricingSortBy") || "createdAt";
  const pricingSortOrder = searchParamsObj.get("pricingSortOrder") || "desc";

  // Create runsKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so runs re-fetch when filters change
  const runsKey = [
    pricingPage,
    pricingPageSize,
    pricingSearch || "",
    (pricingModelIds || []).join(","),
    (pricingProfileIds || []).join(","),
    (pricingActorIds || []).join(","),
    pricingSortBy,
    pricingSortOrder,
    filters.startDate, // Include analytics filters to trigger re-fetch when filters change
    filters.endDate,
    filters.cohortIds.join(","),
    filters.departmentIds.join(","),
    filters.roles.join(","),
    (
      filters as typeof filters & { simulationFilters?: string[] }
    ).simulationFilters?.join(",") || "general",
  ].join("|");

  // Create empty runs data for loading state
  const emptyRunsData: PricingRunsOut = {
    group_runs: [],
    total_count: 0,
    page: pricingPage,
    page_size: pricingPageSize,
    total_pages: 0,
    model_options: [],
    profile_options: [],
    actor_options: [],
    models: [],
    profiles: [],
    agents: [],
    personas: [],
  };

  return (
    <div className="space-y-6" data-page="pricing-index">
      {/* This never gets unmounted when runsKey changes */}
      <PricingSummary pricingData={pricingData} />

      {/* Only the runs section is tied to runsKey */}
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
          pricingSearch={pricingSearch}
          pricingModelIds={pricingModelIds}
          pricingProfileIds={pricingProfileIds}
          pricingActorIds={pricingActorIds}
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
  pricingSearch,
  pricingModelIds,
  pricingProfileIds,
  pricingActorIds,
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
  pricingSearch?: string | undefined;
  pricingModelIds?: string[] | undefined;
  pricingProfileIds?: string[] | undefined;
  pricingActorIds?: string[] | undefined;
  pricingSortBy: string;
  pricingSortOrder: string;
}) {
  // Build runs filters with pagination/search/sorting/filtering params
  const runsFilters = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: filters.cohortIds,
    department_ids: filters.departmentIds,
    roles: filters.roles,
    simulation_filters: filters.simulationFilters,
    search: pricingSearch || "",
    model_ids: pricingModelIds || [],
    profile_ids: pricingProfileIds || [],
    actor_ids: pricingActorIds || [],
    sort_by: pricingSortBy,
    sort_order: pricingSortOrder,
    limit_count: pricingPageSize,
    offset_count: pricingPage * pricingPageSize,
  };

  // Fetch runs data server-side
  const runsData = await getPricingRuns({
    body: runsFilters,
  });

  return <PricingRunsClient runsData={runsData} isLoading={false} />;
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut, PricingRunsIn, PricingRunsOut };
