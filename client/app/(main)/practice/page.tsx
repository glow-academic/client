/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Practice from "@/components/practice/Practice";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { Suspense } from "react";

/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/api/v3/practice/overview", "post">;
type PracticeOut = OutputOf<"/api/v3/practice/overview", "post">;
type PracticeHistoryIn = InputOf<"/api/v3/practice/history", "post">;
type PracticeHistoryOut = OutputOf<"/api/v3/practice/history", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Practice overview responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPractice = async (
  input: PracticeIn
): Promise<PracticeOut> => {
  const bypassCache = await isHardRefresh();
  
  return api.post("/practice/overview", input, {
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
      (cacheControl?.toLowerCase().includes("no-cache") || 
       cacheControl?.includes("max-age=0")) ||
      pragma?.toLowerCase() === "no-cache"
    );
  } catch {
    return false;
  }
}

/** ---- Direct fetch (no Next.js cache) ----
 * Practice history responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 * Note: Practice history endpoint doesn't use Redis cache, but header is sent for consistency.
 */
const getPracticeHistory = async (
  input: PracticeHistoryIn
): Promise<PracticeHistoryOut> => {
  const bypassCache = await isHardRefresh();
  
  return api.post("/practice/history", input, {
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

export const metadata: Metadata = {
  title: "Practice",
  description: `Practice page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server action to revalidate attempt cache when simulation starts ---- */
async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Invalidate practice page cache so data refreshes when user returns
  revalidateTag("practice");
  revalidatePath("/practice");
  // Note: Chat-specific tags can be added here if chat IDs are known
  // For now, invalidating attempt-level cache ensures all chats refresh
}

interface PracticePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PracticePage({
  searchParams,
}: PracticePageProps) {
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

  // Get profileId and departmentIds from profile context
  const profileContext = await getProfileContext({
    body: {
      actualProfileId: session?.user?.profileId || "guest-profile-id",
      effectiveProfileId: session?.effectiveProfileId || "guest-profile-id",
      pathname: "/practice",
    },
  });

  // Build practice filters (only profileId and departmentIds)
  // Always pass departmentIds (never empty array) - use all IDs from profile context
  const practiceFiltersBody: PracticeIn["body"] = {
    profileId: session?.effectiveProfileId || "guest-profile-id",
    departmentIds: profileContext.departmentIds || [], // Always pass (non-empty from profile context)
  };

  const practiceFilters: PracticeIn = {
    body: practiceFiltersBody,
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

  // Fetch practice data server-side (without history - history will be fetched separately)
  const practiceData = await getPractice(practiceFilters);

  // Remove history from response for server-driven pagination
  const practiceDataWithoutHistory = {
    ...practiceData,
    history: [],
  };

  // Check if user is a guest
  const effectiveProfileId = session?.effectiveProfileId || "guest-profile-id";
  const isGuest =
    effectiveProfileId === "guest-profile-id" ||
    profileContext.effectiveProfile?.role === "guest";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so history re-fetches when filters change
  const analyticsStartDate = searchParamsObj.get("startDate") || "";
  const analyticsEndDate = searchParamsObj.get("endDate") || "";
  const analyticsCohortIds = searchParamsObj.get("cohortIds") || "";
  const analyticsDepartmentIds = searchParamsObj.get("departmentIds") || "";
  const analyticsRoles = searchParamsObj.get("roles") || "";
  const analyticsSimulationFilters = searchParamsObj.get("simulationFilters") || "general";
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
    analyticsStartDate, // Include analytics filters to trigger re-fetch when filters change
    analyticsEndDate,
    analyticsCohortIds,
    analyticsDepartmentIds,
    analyticsRoles,
    analyticsSimulationFilters,
  ].join("|");

  return (
    <div className="space-y-6">
      <Practice
        practiceData={practiceDataWithoutHistory}
        revalidateAttemptAction={revalidateAttempt}
        isGuest={isGuest}
      />

      {/* History section moved out of Practice, fully server-driven - only show for non-guests */}
      {!isGuest && (
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
                showExport={false}
                showArchive={false}
                singleProfile={true}
                revalidateAttemptAction={revalidateAttempt}
                profileOptions={[]}
                simulationOptions={[]}
                scenarioOptions={[]}
                isLoading={true}
                showModeFilter={true}
              />
            }
          >
            <PracticeHistorySection
              historyPage={historyPage}
              historyPageSize={historyPageSize}
              historySearch={historySearch}
              historyProfileIds={historyProfileIds}
              historySimulationIds={historySimulationIds}
              historyScenarioIds={historyScenarioIds}
              historyInfiniteMode={historyInfiniteMode}
              historySortBy={historySortBy}
              historySortOrder={historySortOrder}
              effectiveProfileId={effectiveProfileId}
              departmentIds={profileContext.departmentIds || []}
              revalidateAttemptAction={revalidateAttempt}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function PracticeHistorySection({
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
  departmentIds,
  revalidateAttemptAction,
}: {
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historyProfileIds?: string[] | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  effectiveProfileId: string;
  departmentIds: string[];
  revalidateAttemptAction: (attemptId: string) => Promise<void>;
}) {
  // Build history filters for practice (simplified: profileId and departmentIds only)
  const historyFilters: PracticeHistoryIn = {
    body: {
      profileId: effectiveProfileId,
      departmentIds: departmentIds,
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

  const historyData = await getPracticeHistory(historyFilters);

  // Calculate archived/unarchived counts from data (practice history API doesn't provide these)
  const archivedCount = historyData.data.filter((item) => item.isArchived).length;
  const unarchivedCount = historyData.data.filter((item) => !item.isArchived).length;

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
      showExport={false}
      showArchive={false}
      singleProfile={true}
      revalidateAttemptAction={revalidateAttemptAction}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showModeFilter={true}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryIn, PracticeHistoryOut, PracticeIn, PracticeOut };
