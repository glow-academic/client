/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Home from "@/components/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { Suspense } from "react";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/api/v3/home/overview", "post">;
type HomeOut = OutputOf<"/api/v3/home/overview", "post">;
type HomeHistoryIn = InputOf<"/api/v3/home/history", "post">;
type HomeHistoryOut = OutputOf<"/api/v3/home/history", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Home overview responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getHomeOverview = async (input: HomeIn): Promise<HomeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/home/overview", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Helper to detect hard refresh ----
 * Checks for Cache-Control or Pragma headers that browsers send on hard refresh.
 */
async function isHardRefresh(): Promise<boolean> {
  try {
    const headersList = await headers();
    const cacheControl = headersList.get("cache-control");
    const pragma = headersList.get("pragma");

    return (
      cacheControl?.toLowerCase().includes("no-cache") ||
      cacheControl?.includes("max-age=0") ||
      pragma?.toLowerCase() === "no-cache"
    );
  } catch {
    return false;
  }
}

/** ---- Direct fetch (no Next.js cache) ----
 * Home history responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getHomeHistory = async (
  input: HomeHistoryIn
): Promise<HomeHistoryOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/home/history", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

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

/** ---- Inline filters function for home page ---- */
async function getHomeFilters(searchParams?: URLSearchParams) {
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
    startDate: filters.startDate,
    endDate: filters.endDate,
    cohortIds,
    departmentIds,
    roles,
  };
}

export const metadata: Metadata = {
  title: "Home",
  description: `Home page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server action to revalidate attempt cache when simulation starts ---- */
async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Invalidate history sections only - overview sections are based on MVs and don't need invalidation
  revalidateTag("home:history");
  revalidatePath("/home");
  // Note: Chat-specific tags can be added here if chat IDs are known
  // For now, invalidating attempt-level cache ensures all chats refresh
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();

  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults, then subset to Home fields
  // Note: getHomeFilters uses getProfileContext which is now cached
  const defaultFilters = await getHomeFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract subset for Home: startDate, endDate, profileId (required)
  // Always include cohortIds and departmentIds (they are guaranteed to be non-empty from getHomeFilters)
  // profileId is required for TA mode detection and role hierarchy filtering
  const homeFilters: HomeIn = {
    body: {
      startDate: defaultFilters.startDate,
      endDate: defaultFilters.endDate,
      cohortIds: defaultFilters.cohortIds, // Always non-empty
      departmentIds: defaultFilters.departmentIds, // Always non-empty
      profileId: session?.effectiveProfileId || "guest-profile-id", // Required for TA mode detection
    },
  };

  // Extract pagination and filter params from search params
  const historyPage = searchParamsObj.get("historyPage")
    ? parseInt(searchParamsObj.get("historyPage") || "0", 10)
    : 0;
  const historyPageSize = searchParamsObj.get("historyPageSize")
    ? parseInt(searchParamsObj.get("historyPageSize") || "10", 10)
    : 10;
  const historySearch = searchParamsObj.get("historySearch") || undefined;
  const historyProfileIds = searchParamsObj.get("historyProfileIds")
    ? searchParamsObj.get("historyProfileIds")?.split(",").filter(Boolean)
    : undefined;
  const historySimulationIds = searchParamsObj.get("historySimulationIds")
    ? searchParamsObj.get("historySimulationIds")?.split(",").filter(Boolean)
    : undefined;
  const historyScenarioIds = searchParamsObj.get("historyScenarioIds")
    ? searchParamsObj.get("historyScenarioIds")?.split(",").filter(Boolean)
    : undefined;
  const historyInfiniteMode =
    searchParamsObj.get("historyInfiniteMode") === "true"
      ? true
      : searchParamsObj.get("historyInfiniteMode") === "false"
        ? false
        : undefined;
  const historySortBy = searchParamsObj.get("historySortBy") || "date";
  const historySortOrder = searchParamsObj.get("historySortOrder") || "desc";

  // Fetch home data server-side (without history - history will be fetched separately)
  const homeData = await getHomeOverview(homeFilters);

  // Remove history from response for server-driven pagination
  const homeDataWithoutHistory = {
    ...homeData,
    history: [],
  };

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so history re-fetches when filters change
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historyProfileIds || []).join(","),
    (historySimulationIds || []).join(","),
    (historyScenarioIds || []).join(","),
    historyInfiniteMode === undefined
      ? "all"
      : historyInfiniteMode
        ? "inf"
        : "std",
    historySortBy,
    historySortOrder,
    defaultFilters.startDate, // Include analytics filters to trigger re-fetch when filters change
    defaultFilters.endDate,
    defaultFilters.cohortIds.join(","),
    defaultFilters.departmentIds.join(","),
    defaultFilters.roles.join(","),
    (
      defaultFilters as typeof defaultFilters & { simulationFilters?: string[] }
    ).simulationFilters?.join(",") || "general",
  ].join("|");

  return (
    <div className="space-y-6">
      <Home
        homeData={homeDataWithoutHistory}
        revalidateAttemptAction={revalidateAttempt}
      />

      {/* History section moved out of Home, fully server-driven */}
      <div className="mt-12">
        <Suspense
          key={historyKey}
          fallback={
            <SimulationHistory
              data={[]}
              totalCount={0}
              archivedCount={0}
              unarchivedCount={0}
              pageIndex={historyPage}
              pageSize={historyPageSize}
              showExport={true}
              showArchive={false}
              singleProfile={true}
              revalidateAttemptAction={revalidateAttempt}
              initialFilters={defaultFilters}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <HomeHistorySection
            defaultFilters={defaultFilters}
            historyPage={historyPage}
            historyPageSize={historyPageSize}
            historySearch={historySearch}
            historyProfileIds={historyProfileIds}
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
            effectiveProfileId={session?.effectiveProfileId ?? null}
            revalidateAttemptAction={revalidateAttempt}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function HomeHistorySection({
  defaultFilters,
  historyPage,
  historyPageSize,
  historySearch,
  historyProfileIds,
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  effectiveProfileId,
  revalidateAttemptAction,
}: {
  defaultFilters: {
    startDate: string;
    endDate: string;
    cohortIds: string[];
    departmentIds: string[];
    roles: string[];
  };
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  effectiveProfileId?: string | null;
  revalidateAttemptAction: (attemptId: string) => Promise<void>;
}) {
  // Build history filters matching logic from page.tsx
  // profileId is required for department scoping
  const historyFilters: HomeHistoryIn = {
    body: {
      profileId: effectiveProfileId || "guest-profile-id",
      startDate: defaultFilters.startDate,
      endDate: defaultFilters.endDate,
      cohortIds: defaultFilters.cohortIds,
      departmentIds: defaultFilters.departmentIds,
      roles: defaultFilters.roles,
      page: historyPage,
      pageSize: historyPageSize,
      ...(historySearch && { search: historySearch }),
      ...(historyProfileIds &&
        historyProfileIds.length > 0 && {
          profileIds: historyProfileIds,
        }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulationIds: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenarioIds: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infiniteMode: historyInfiniteMode,
      }),
      sortBy: historySortBy,
      sortOrder: historySortOrder,
    },
  };

  const historyData = await getHomeHistory(historyFilters);

  // Calculate archived/unarchived counts from data (home history API doesn't provide these)
  const archivedCount = historyData.data.filter(
    (item) => item.isArchived
  ).length;
  const unarchivedCount = historyData.data.filter(
    (item) => !item.isArchived
  ).length;

  // Use server-provided data directly (no transformation needed)
  // Extract options from API response and cast to expected format
  const profileOptions = (historyData.profileOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });
  const simulationOptions = (historyData.simulationOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });
  const scenarioOptions = (historyData.scenarioOptions || []).map((opt) => {
    const count = typeof opt["count"] === "number" ? opt["count"] : undefined;
    return {
      value: String(opt["value"] || ""),
      label: String(opt["label"] || ""),
      ...(count !== undefined && { count }),
    };
  });

  return (
    <SimulationHistory
      data={historyData.data}
      totalCount={historyData.totalCount}
      archivedCount={archivedCount}
      unarchivedCount={unarchivedCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={true}
      showArchive={false}
      singleProfile={true}
      revalidateAttemptAction={revalidateAttemptAction}
      initialFilters={defaultFilters}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeHistoryIn, HomeHistoryOut, HomeIn, HomeOut };
