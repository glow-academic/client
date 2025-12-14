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
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
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
const getPractice = async (input: PracticeIn): Promise<PracticeOut> => {
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for profileContext (permissions, role, navigation).
 */
const getProfileContext = async (input: {
  body: {
    actualProfileId: string | null;
    effectiveProfileId: string | null;
    pathname: string;
  };
}): Promise<{
  effectiveProfile: { id: string; role: string };
  actualProfile: { id: string; role: string };
  departmentIds: string[];
  [key: string]: unknown;
}> => {
  // Forward cookies from server component context to API request
  // This is needed because server components run server-side and cookies aren't automatically forwarded
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = [
    cookieStore.get("department-id")?.value &&
      `department-id=${cookieStore.get("department-id")?.value}`,
    cookieStore.get("auth-mode")?.value &&
      `auth-mode=${cookieStore.get("auth-mode")?.value}`,
  ]
    .filter(Boolean)
    .join("; ");

  return api.post(
    "/profile/context",
    {
      body: {
        actualProfileId:
          input.body.actualProfileId ?? (null as unknown as string),
        effectiveProfileId:
          input.body.effectiveProfileId ?? (null as unknown as string),
        pathname: input.body.pathname,
      },
    },
    cookieHeader
      ? {
          cache: "no-store",
          headers: {
            "X-Bypass-Cache": "1",
            Cookie: cookieHeader,
          },
        }
      : {
          cache: "no-store",
          headers: {
            "X-Bypass-Cache": "1",
          },
        }
  ) as Promise<{
    effectiveProfile: { id: string; role: string };
    actualProfile: { id: string; role: string };
    departmentIds: string[];
    [key: string]: unknown;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Practice",
    description:
      "Simulation-based practice sessions for teaching assistant training. Engage in realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through hands-on learning experiences.",
  };
}

interface PracticePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PracticePage({
  searchParams,
}: PracticePageProps) {
  // Access control is handled server-side in layout
  // Practice page allows guest role users (authenticated users with guest role)
  // Get profile IDs from session
  const session = await getSession();
  let effectiveProfileId = session?.effectiveProfileId;
  let actualProfileId = session?.user?.profileId;

  // For guest/default-account users, session doesn't have profile IDs
  // Resolve from cookies (same as layout does)
  if (!effectiveProfileId || !actualProfileId) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const authMode = cookieStore.get("auth-mode")?.value;

      if (
        authMode &&
        (authMode === "default-guest" || authMode === "default-account")
      ) {
        // Resolve profile from cookies
        const profileContext = await getProfileContext({
          body: {
            actualProfileId: null,
            effectiveProfileId: null,
            pathname: "/practice",
          },
        });

        if (
          profileContext?.effectiveProfile?.id &&
          profileContext?.actualProfile?.id
        ) {
          effectiveProfileId = profileContext.effectiveProfile.id;
          actualProfileId = profileContext.actualProfile.id;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

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

  // Get profileId and departmentIds from profile context with resolved UUIDs
  let profileContext;
  try {
    profileContext = await getProfileContext({
      body: {
        actualProfileId,
        effectiveProfileId,
        pathname: "/practice",
      },
    });
  } catch (error) {
    // Handle 401 Unauthorized (invalid session - profile doesn't exist)
    // This can happen if the database was reset but the session still has old profile IDs
    // The layout's getLayoutContextData will also fail with the same 401 error,
    // and the layout will show access denied UI. Re-throw the error so the layout handles it.
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 401
    ) {
      // Re-throw the error - the layout's getLayoutContextData will also fail with 401,
      // and the updated layout code will show access denied UI
      throw error;
    }
    // Re-throw other errors
    throw error;
  }

  // Build practice filters (only profileId and departmentIds)
  // Always pass departmentIds (never empty array) - use all IDs from profile context
  const practiceFiltersBody: PracticeIn["body"] = {
    profileId: effectiveProfileId,
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
  // Note: effectiveProfileId is already resolved above
  const isGuest =
    !effectiveProfileId || profileContext.effectiveProfile?.role === "guest";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so history re-fetches when filters change
  const analyticsStartDate = searchParamsObj.get("startDate") || "";
  const analyticsEndDate = searchParamsObj.get("endDate") || "";
  const analyticsCohortIds = searchParamsObj.get("cohortIds") || "";
  const analyticsDepartmentIds = searchParamsObj.get("departmentIds") || "";
  const analyticsRoles = searchParamsObj.get("roles") || "";
  const analyticsSimulationFilters =
    searchParamsObj.get("simulationFilters") || "general";
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
      <Practice practiceData={practiceDataWithoutHistory} isGuest={isGuest} />

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
      showExport={false}
      showArchive={false}
      singleProfile={true}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showModeFilter={true}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryIn, PracticeHistoryOut, PracticeIn, PracticeOut };
