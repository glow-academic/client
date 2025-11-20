/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */
import { getSession } from "@/auth";
import { Suspense } from "react";

import Pricing from "@/components/pricing/Pricing";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v3/pricing/analytics", "post">;
type PricingOut = OutputOf<"/api/v3/pricing/analytics", "post">;
type PricingRunsIn = InputOf<"/api/v3/pricing/runs", "post">;
type PricingRunsOut = OutputOf<"/api/v3/pricing/runs", "post">;

/** ---- Cached fetch with Next tags ----
 * Tags allow revalidateTag("pricing") to invalidate.
 */
const getPricingAnalytics = unstable_cache(
  async (input: PricingIn): Promise<PricingOut> => {
    return api.post("/pricing/analytics", input);
  },
  ["pricing", "pricing:analytics"],
  { tags: ["pricing", "pricing:analytics"] }
);

const getPricingRuns = unstable_cache(
  async (input: PricingRunsIn): Promise<PricingRunsOut> => {
    return api.post("/pricing/runs", input);
  },
  ["pricing", "pricing:runs"],
  { tags: ["pricing", "pricing:runs"] }
);

const getProfileContext = unstable_cache(
  async (input: {
    body: {
      actualProfileId: string;
      effectiveProfileId: string;
      pathname: string;
    };
  }) => {
    return api.post("/profile/context", input);
  },
  ["profile:context"],
  { tags: ["profile:context"] }
);

/** ---- Inline filters function for pricing page ---- */
async function getPricingFilters(searchParams?: URLSearchParams) {
  const session = await getSession();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await getProfileContext({
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
      : profileContext.cohortIds || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.departmentIds || [];
  const roles =
    filters.roles && filters.roles.length > 0
      ? filters.roles
      : profileContext.scopedRoles || [];

  return {
    ...filters,
    cohortIds,
    departmentIds,
    roles,
  };
}

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

  // Fetch summary data server-side (for chart - all runs, no pagination)
  const pricingData = await getPricingAnalytics({
    body: filters,
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
  const runsKey = [
    pricingPage,
    pricingPageSize,
    pricingSearch || "",
    (pricingModelIds || []).join(","),
    (pricingProfileIds || []).join(","),
    (pricingActorIds || []).join(","),
    pricingSortBy,
    pricingSortOrder,
  ].join("|");

  // Create empty runs data for loading state
  const emptyRunsData: PricingRunsOut = {
    data: [],
    totalCount: 0,
    page: pricingPage,
    pageSize: pricingPageSize,
    totalPages: 0,
    modelOptions: [],
    profileOptions: [],
    actorOptions: [],
    model_mapping: {},
    profile_mapping: {},
    agent_mapping: {},
    persona_mapping: {},
  };

  return (
    <div className="space-y-6" data-page="pricing-index">
      <Suspense
        key={runsKey}
        fallback={
          <Pricing
            pricingData={pricingData}
            runsData={emptyRunsData}
            isLoading={true}
            modelOptions={[]}
            profileOptions={[]}
            actorOptions={[]}
          />
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
          pricingData={pricingData}
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
  pricingData,
}: {
  filters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  pricingPage: number;
  pricingPageSize: number;
  pricingSearch?: string | undefined;
  pricingModelIds?: string[] | undefined;
  pricingProfileIds?: string[] | undefined;
  pricingActorIds?: string[] | undefined;
  pricingSortBy: string;
  pricingSortOrder: string;
  pricingData: PricingOut;
}) {
  // Build runs filters with pagination/search/sorting/filtering params
  const runsFilters = {
    ...filters,
    page: pricingPage,
    pageSize: pricingPageSize,
    ...(pricingSearch && { search: pricingSearch }),
    sortBy: pricingSortBy,
    sortOrder: pricingSortOrder,
    ...(pricingModelIds &&
      pricingModelIds.length > 0 && {
        modelIds: pricingModelIds,
      }),
    ...(pricingProfileIds &&
      pricingProfileIds.length > 0 && {
        profileIds: pricingProfileIds,
      }),
    ...(pricingActorIds &&
      pricingActorIds.length > 0 && {
        actorIds: pricingActorIds,
      }),
  };

  // Fetch runs data server-side
  const runsData = await getPricingRuns({
    body: runsFilters,
  });

  // Extract and map filter options from API response
  const modelOptions = (runsData?.modelOptions || []).map((opt) => ({
    value: opt.value,
    label: opt.label,
    count: opt.count,
  }));

  const profileOptions = (runsData?.profileOptions || []).map((opt) => ({
    value: opt.value,
    label: opt.label,
    count: opt.count,
  }));

  const actorOptions = (runsData?.actorOptions || []).map((opt) => ({
    value: opt.value,
    label: opt.label,
    count: opt.count,
  }));

  return (
    <Pricing
      pricingData={pricingData}
      runsData={runsData}
      isLoading={false}
      modelOptions={modelOptions}
      profileOptions={profileOptions}
      actorOptions={actorOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut, PricingRunsIn, PricingRunsOut };
