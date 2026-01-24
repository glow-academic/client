/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Report from "@/components/reports/Report";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata, ResolvingMetadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../../../../layout-server";

/** ---- Strong types from OpenAPI ---- */
type ReportsOverviewIn = InputOf<"/api/v4/analytics/reports/get", "post">;
type ReportsOverviewOut = OutputOf<"/api/v4/analytics/reports/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports overview responses exceed Next.js 2MB cache limit (~12.9MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReportsOverview = async (
  input: ReportsOverviewIn
): Promise<ReportsOverviewOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/analytics/reports/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Inline filters function for profile reports page ---- */
async function getProfileReportsFilters(searchParams?: URLSearchParams) {
  // Use cached layout context (reuses data already fetched by layout)
  const profileContext = await getLayoutContext({
    body: {},
  });
  const actorProfileId = profileContext.id || null;

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
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: cohortIds,
    department_ids: departmentIds,
    roles,
    simulation_filters: filters.simulationFilters,
    actor_profile_id: actorProfileId,
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;

  try {
    // Get profile data from reports endpoint instead of separate profile endpoint
    const profileContext = await getLayoutContext({
      body: {},
    });

    // Compute startDate using same logic as analytics context
    let startDate: Date;
    if (profileContext.earliest_attempt_date) {
      startDate = new Date(profileContext.earliest_attempt_date);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const reportsData = await getReportsOverview({
      body: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        cohort_ids: profileContext.cohort_ids || [],
        department_ids: profileContext.department_ids || [],
        roles: profileContext.scoped_roles || [],
        simulation_filters: ["general"],
        actor_profile_id:
          profileContext.id || profileId,
        target_profile_id: profileId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const name = reportsData.profile_name || "";
    return {
      title: name,
      description: `${name ? `${name} - ` : ""}Individual teaching assistant performance reports and assessment analytics. Track pedagogical progress, teaching effectiveness metrics, and professional development outcomes through detailed evaluation data.`,
    };
  } catch {
    return {
      title: "Profile Report",
      description:
        "Individual teaching assistant performance reports and assessment analytics. Track pedagogical progress, teaching effectiveness metrics, and professional development outcomes through detailed evaluation data.",
    };
  }
}

interface ProfileReportsPageProps {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsPage({
  params,
  searchParams,
}: ProfileReportsPageProps) {
  const { profileId } = await params;
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)

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

  // Get filters from search params or defaults
  const defaultFilters = await getProfileReportsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );
  const reportsFilters = {
    start_date: defaultFilters.start_date,
    end_date: defaultFilters.end_date,
    cohort_ids: defaultFilters.cohort_ids,
    department_ids: defaultFilters.department_ids,
    roles: defaultFilters.roles,
    simulation_filters: defaultFilters.simulation_filters,
    actor_profile_id: defaultFilters.actor_profile_id || profileId,
    target_profile_id: profileId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  // Extract pagination and filter params from search params for history
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
    defaultFilters.start_date,
    defaultFilters.end_date,
    defaultFilters.cohort_ids.join(","),
    defaultFilters.department_ids.join(","),
    defaultFilters.roles.join(","),
    (
      defaultFilters as typeof defaultFilters & {
        simulation_filters?: string[];
      }
    ).simulation_filters?.join(",") || "general",
  ].join("|");

  // Fetch reports overview data server-side (includes profile data)
  const reportsData = await getReportsOverview({
    body: reportsFilters,
  });

  // Extract profile data from reports response (Report component only needs name, emails, role)
  const profileData = {
    name: reportsData.profile_name || null,
    emails: reportsData.profile_emails || null,
    primary_email: reportsData.profile_primary_email || null,
    role: reportsData.profile_role || null,
  };

  return (
    <div className="space-y-6">
      <Report
        profileId={profileId}
        profileData={profileData}
        dashboardData={reportsData}
      />

      {/* History section - filtered by profileId */}
      <div className="">
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
              initialFilters={{
                startDate: defaultFilters.start_date,
                endDate: defaultFilters.end_date,
                cohortIds: defaultFilters.cohort_ids,
                departmentIds: defaultFilters.department_ids,
                roles: defaultFilters.roles,
              }}
              profileOptions={[]}
              simulationOptions={[]}
              scenarioOptions={[]}
              isLoading={true}
            />
          }
        >
          <ReportHistorySection
            reportsData={reportsData}
            defaultFilters={defaultFilters}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function ReportHistorySection({
  reportsData,
  defaultFilters,
}: {
  reportsData: ReportsOverviewOut;
  defaultFilters: {
    start_date: string;
    end_date: string;
    cohort_ids: string[];
    department_ids: string[];
    roles: string[];
    simulation_filters: string[];
  };
}) {
  // Use embedded history from reports overview response
  const history = reportsData.history || [];

  return (
    <SimulationHistory
      data={history}
      totalCount={history.length}
      archivedCount={0}
      unarchivedCount={history.length}
      pageIndex={0}
      pageSize={history.length}
      showExport={false}
      showArchive={false}
      singleProfile={true}
      initialFilters={{
        startDate: defaultFilters.start_date,
        endDate: defaultFilters.end_date,
        cohortIds: defaultFilters.cohort_ids,
        departmentIds: defaultFilters.department_ids,
        roles: defaultFilters.roles,
      }}
      profileOptions={[]}
      simulationOptions={[]}
      scenarioOptions={[]}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsOverviewIn, ReportsOverviewOut };
