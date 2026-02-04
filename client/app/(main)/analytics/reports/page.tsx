/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Reports from "@/components/reports/Reports";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  searchParamsToFilters,
  type AnalyticsFilters,
} from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../../layout-server";

/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/api/v4/artifacts/reports/get", "post">;
type ReportsOut = OutputOf<"/api/v4/artifacts/reports/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Reports responses exceed Next.js 2MB cache limit (~3.2MB).
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getReports = async (input: ReportsIn): Promise<ReportsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/reports/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Inline filters function for reports page ---- */
async function getReportsFilters(searchParams?: URLSearchParams) {
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
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

  const result: AnalyticsFilters = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (cohortIds.length > 0) result.cohortIds = cohortIds;
  if (departmentIds.length > 0) result.departmentIds = departmentIds;
  if (roles.length > 0) result.roles = roles;
  if (filters.simulationFilters.length > 0)
    result.simulationFilters = filters.simulationFilters;
  return result;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Reports",
    description:
      "Comprehensive assessment reports and evaluation data for teaching assistant training. Generate detailed performance analytics, pedagogical assessment summaries, and learning progress reports to track teaching effectiveness and professional development.",
  };
}

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsFullPage({
  searchParams,
}: ReportsPageProps) {
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)
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
  const filters = await getReportsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract pagination and filter params from search params for reports table
  const reportsPage = searchParamsObj.get("reportsPage")
    ? parseInt(searchParamsObj.get("reportsPage") || "0", 10)
    : 0;
  const reportsPageSize = searchParamsObj.get("reportsPageSize")
    ? parseInt(searchParamsObj.get("reportsPageSize") || "100", 10)
    : 100;
  const reportsSearch = searchParamsObj.get("reportsSearch") || undefined;
  const reportsProfileIds = searchParamsObj.get("reportsProfileIds")
    ? searchParamsObj.get("reportsProfileIds")?.split(",").filter(Boolean)
    : undefined;
  const reportsSimulationIds = searchParamsObj.get("reportsSimulationIds")
    ? searchParamsObj.get("reportsSimulationIds")?.split(",").filter(Boolean)
    : undefined;
  const reportsScenarioIds = searchParamsObj.get("reportsScenarioIds")
    ? searchParamsObj.get("reportsScenarioIds")?.split(",").filter(Boolean)
    : undefined;
  const reportsSortBy = searchParamsObj.get("reportsSortBy") || "averageScore";
  const reportsSortOrder = searchParamsObj.get("reportsSortOrder") || "desc";

  // Create reportsKey for Suspense boundary to trigger re-fetch on URL param changes
  // Include analytics filter params so reports re-fetch when filters change
  const reportsKey = [
    reportsPage,
    reportsPageSize,
    reportsSearch || "",
    (reportsProfileIds || []).join(","),
    (reportsSimulationIds || []).join(","),
    (reportsScenarioIds || []).join(","),
    reportsSortBy,
    reportsSortOrder,
    filters.startDate, // Include analytics filters to trigger re-fetch when filters change
    filters.endDate,
    (filters.cohortIds || []).join(","),
    (filters.departmentIds || []).join(","),
    (filters.roles || []).join(","),
    (
      filters as typeof filters & { simulationFilters?: string[] }
    ).simulationFilters?.join(",") || "general",
  ].join("|");

  // Create empty reports data for loading state
  const emptyReportsData = {
    header: {
      firstAttemptPassRate: {
        hasData: false,
        method: "rate",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      messagesPerSession: {
        hasData: false,
        method: "avg",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      averageScore: {
        hasData: false,
        method: "avg",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      highestScore: {
        hasData: false,
        method: "max",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      completionPercentage: {
        hasData: false,
        method: "avg",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      sessionEfficiency: {
        hasData: false,
        method: "avg",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      timeSpent: {
        hasData: false,
        method: "avg",
        currentValue: 0,
        status: "neutral",
        trendData: [],
        dataPoints: [],
      },
      totalAttempts: {
        hasData: false,
        method: "countDistinct" as const,
        currentValue: 0,
        status: "neutral" as const,
        trendData: [],
        dataPoints: [],
      },
      personaResponseTimes: {
        hasData: false,
        method: "avg" as const,
        currentValue: 0,
        status: "neutral" as const,
        trendData: [],
        dataPoints: [],
      },
      stagnationRate: {
        hasData: false,
        method: "rate" as const,
        currentValue: 0,
        status: "neutral" as const,
        trendData: [],
        dataPoints: [],
      },
    },
    primary: {
      growthData: {
        chartData: [],
        availableMetrics: [],
        windowAverages: {
          averageScore: { n: 7, last: null, prev: null },
        },
        status: "neutral" as const,
      },
      personaPerformance: {
        chartData: [],
        validSimulationIds: [],
        personaColors: {},
      },
      rubricHeatmap: {
        matrices: [],
        validRubricIds: [],
        status: "neutral" as const,
      },
    },
    secondary: {
      attemptImprovement: {
        chartData: [],
        facts: [],
        validSimulationIds: [],
        status: "neutral" as const,
      },
      cohortPerformance: {
        cohortData: [],
        dailyData: [],
        cohortFacts: [],
        dailyFacts: [],
        validSimulationIds: [],
        status: "neutral" as const,
      },
      skillPerformance: {
        packages: [],
        validRubricIds: [],
        status: "neutral" as const,
      },
    },
    footer: {
      scenarioPerformance: {
        validParameterIds: [],
        attributeAttemptFacts: [],
        attributeScenarioFacts: [],
        status: "neutral" as const,
      },
      scenarioStats: {
        numericAttemptFacts: [],
        numericScenarioFacts: [],
        validParameterIds: [],
        validNumericParameterIds: [],
        status: "neutral" as const,
      },
      simulationPerformance: {
        validSimulationIds: [],
        scenarioFacts: [],
        status: "neutral" as const,
      },
      simulationComposition: {
        simulationFacts: [],
        validSimulationIds: [],
        simulationParameterFactsCategorical: [],
        simulationParameterFactsNumeric: [],
        hasData: false,
        status: "neutral" as const,
      },
    },
    history: [],
    insights: {
      growth: null,
      persona: {},
      rubric_heatmap: null,
      attempt_improvement: null,
      cohort: {},
      skill_performance: null,
      scenario_performance: null,
      scenario_stats: null,
      simulation_performance: null,
      simulation_composition: null,
    },
    thresholds: {
      danger: 70,
      warning: 80,
      success: 85,
    },
    simulations: [],
    rubric_mapping: {},
    parameter_mapping: {},
    field_mapping: {},
  } as unknown as ReportsOut;

  return (
    <div className="space-y-6" data-page="reports-index">
      <Suspense
        key={reportsKey}
        fallback={
          <Reports
            reportsData={emptyReportsData}
            filters={filters}
            isLoading={true}
            profileOptions={[]}
            simulationOptions={[]}
            scenarioOptions={[]}
          />
        }
      >
        <ReportsSection
          filters={filters}
          reportsPage={reportsPage}
          reportsPageSize={reportsPageSize}
          reportsSearch={reportsSearch}
          reportsProfileIds={reportsProfileIds}
          reportsSimulationIds={reportsSimulationIds}
          reportsScenarioIds={reportsScenarioIds}
          reportsSortBy={reportsSortBy}
          reportsSortOrder={reportsSortOrder}
        />
      </Suspense>
    </div>
  );
}

/** ---- Inline reports section component (only used here) ---- */
async function ReportsSection({
  filters,
  reportsPage,
  reportsPageSize,
  reportsSearch,
  reportsProfileIds,
  reportsSimulationIds,
  reportsScenarioIds,
  reportsSortBy,
  reportsSortOrder,
}: {
  filters: AnalyticsFilters;
  reportsPage: number;
  reportsPageSize: number;
  reportsSearch?: string | undefined;
  reportsProfileIds?: string[] | undefined;
  reportsSimulationIds?: string[] | undefined;
  reportsScenarioIds?: string[] | undefined;
  reportsSortBy: string;
  reportsSortOrder: string;
}) {
  // Build reports filters with pagination/search/sorting/filtering params (snake_case for API)
  const reportsFilters = {
    start_date: filters.startDate,
    end_date: filters.endDate,
    cohort_ids: filters.cohortIds || [],
    department_ids: filters.departmentIds || [],
    roles: filters.roles || [],
    simulation_filters: filters.simulationFilters || [],
    page: reportsPage,
    page_size: reportsPageSize,
    ...(reportsSearch && { search: reportsSearch }),
    sort_by: reportsSortBy,
    sort_order: reportsSortOrder,
    ...(reportsProfileIds &&
      reportsProfileIds.length > 0 && {
        profile_ids: reportsProfileIds,
      }),
    ...(reportsSimulationIds &&
      reportsSimulationIds.length > 0 && {
        simulation_ids: reportsSimulationIds,
      }),
    ...(reportsScenarioIds &&
      reportsScenarioIds.length > 0 && {
        scenario_ids: reportsScenarioIds,
      }),
  };

  // Fetch reports data server-side
  const reportsData = await getReports({
    body: reportsFilters,
  });

  // Extract filter options from API response (snake_case from server)
  const profileOptions =
    reportsData && "profile_options" in reportsData
      ? (reportsData.profile_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];
  const simulationOptions =
    reportsData && "simulation_options" in reportsData
      ? (reportsData.simulation_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];
  const scenarioOptions =
    reportsData && "scenario_options" in reportsData
      ? (reportsData.scenario_options || []).map(
          (opt: {
            value?: string | null;
            label?: string | null;
            count?: number | null;
          }) => ({
            value: String(opt.value || ""),
            label: String(opt.label || ""),
            count: typeof opt.count === "number" ? opt.count : 0,
          })
        )
      : [];

  return (
    <Reports
      reportsData={reportsData}
      filters={filters}
      isLoading={false}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
