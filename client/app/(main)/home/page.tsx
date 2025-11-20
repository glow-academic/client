/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Home from "@/components/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/api/v3/home/overview", "post">;
type HomeOut = OutputOf<"/api/v3/home/overview", "post">;

/** ---- Inline filters function for home page ---- */
async function getHomeFilters(searchParams?: URLSearchParams) {
  const session = await getSession();

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
  title: "Home",
  description: `Home page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server action to revalidate attempt cache when simulation starts ---- */
async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Invalidate home page cache so data refreshes when user returns
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
  const defaultFilters = await getHomeFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract subset for Home: startDate, endDate (required)
  // Always include cohortIds, departmentIds, and roles (they are guaranteed to be non-empty from getHomeFilters)
  const homeFiltersBody: HomeIn["body"] = {
    startDate: defaultFilters.startDate,
    endDate: defaultFilters.endDate,
    cohortIds: defaultFilters.cohortIds, // Always non-empty
    departmentIds: defaultFilters.departmentIds, // Always non-empty
    roles: defaultFilters.roles, // Scoped roles from profile context
  };

  // profileId is required for TA mode detection and filtering
  // Use effectiveProfileId so the SQL can determine if user is TA and filter accordingly
  if (session?.effectiveProfileId) {
    homeFiltersBody.profileId = session.effectiveProfileId;
    homeFiltersBody.historyProfileId = session.effectiveProfileId;
  }

  const homeFilters: HomeIn = {
    body: homeFiltersBody,
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
  const homeData = await api.post("/home/overview", homeFilters);

  // Remove history from response for server-driven pagination
  const homeDataWithoutHistory = {
    ...homeData,
    history: [],
  };

  // Fetch history data server-side using searchParams (DHH-style: URL is source of truth)
  type HomeHistoryIn = InputOf<"/api/v3/home/history", "post">;
  type HomeHistoryOut = OutputOf<"/api/v3/home/history", "post">;

  const historyFilters: HomeHistoryIn = {
    body: {
      profileId: session?.effectiveProfileId || null,
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

  const historyData = await api.post("/home/history", historyFilters);

  // Transform API response to match SimulationHistory expected format
  type ApiHistoryItem = HomeHistoryOut["data"][number];
  const transformedHistoryData = historyData.data.map(
    (item: ApiHistoryItem) => ({
      attemptId: item.attemptId,
      date: new Date(item.date),
      profileId: item.profileId,
      profileName: item.profileName,
      simulationName: item.simulationName,
      numScenarios: item.numScenarios ?? null,
      numScenariosCompleted: item.numScenariosCompleted,
      infiniteMode: item.infiniteMode,
      timeLimit: item.timeLimit ?? null,
      personaNames: item.personaNames,
      personaColors: item.personaColors,
      scenario_titles: item.scenario_titles,
      score: item.score ?? null,
      simulation_id: item.simulation_id,
      department_id: (() => {
        const deptIds = item.department_ids;
        if (
          deptIds &&
          Array.isArray(deptIds) &&
          deptIds.length > 0 &&
          deptIds[0]
        ) {
          return deptIds[0];
        }
        return "";
      })() as string,
      scenario_ids: item.scenario_ids,
      isArchived: item.isArchived,
      showView: item.showView,
      showContinue: item.showContinue,
      practiceSimulation: item.practiceSimulation ?? false,
      passPct: item.passPct || 70,
      cohortNames: item.cohortNames,
      ...(item.practiceScenarioId && {
        practiceScenarioId: item.practiceScenarioId,
      }),
    })
  );

  // Extract options from API response
  type HistoryDataWithOptions = HomeHistoryOut & {
    profileOptions?: Array<{ value: string; label: string; count?: number }>;
    simulationOptions?: Array<{ value: string; label: string; count?: number }>;
    scenarioOptions?: Array<{ value: string; label: string; count?: number }>;
  };
  const historyDataWithOptions =
    historyData as unknown as HistoryDataWithOptions;
  const profileOptions: Array<{
    value: string;
    label: string;
    count?: number;
  }> = historyDataWithOptions.profileOptions || [];
  const simulationOptions: Array<{
    value: string;
    label: string;
    count?: number;
  }> = historyDataWithOptions.simulationOptions || [];
  const scenarioOptions: Array<{
    value: string;
    label: string;
    count?: number;
  }> = historyDataWithOptions.scenarioOptions || [];

  return (
    <div className="space-y-6">
      <Home
        homeData={homeDataWithoutHistory}
        revalidateAttemptAction={revalidateAttempt}
        initialFilters={defaultFilters}
        historyData={transformedHistoryData}
        historyTotalCount={historyData.totalCount}
        historyPage={historyPage}
        historyPageSize={historyPageSize}
        profileOptions={profileOptions}
        simulationOptions={simulationOptions}
        scenarioOptions={scenarioOptions}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeIn, HomeOut };
