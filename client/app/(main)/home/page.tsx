/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/artifacts/attempt/history/SimulationHistory";
import Home from "@/components/artifacts/attempt/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadHomeSearchParams } from "@/lib/search-params/home";

/** ---- Strong types from OpenAPI ---- */
// Using /training/get for simulation cards (enhanced with stats)
type HomeCardsIn = InputOf<"/api/v4/artifacts/training/get", "post">;
type HomeCardsOut = OutputOf<"/api/v4/artifacts/training/get", "post">;
// Using /attempt/list for history section
type HomeHistoryIn = InputOf<"/api/v4/artifacts/attempt/list", "post">;
type HomeHistoryOut = OutputOf<"/api/v4/artifacts/attempt/list", "post">;
// Using /attempt/create for starting training
type CreateAttemptIn = InputOf<"/api/v4/artifacts/attempt/create", "post">;
type CreateAttemptOut = OutputOf<"/api/v4/artifacts/attempt/create", "post">;

// Home component uses cards data directly (no merge needed)
type HomeOut = HomeCardsOut;

/** ---- Direct fetch for simulation cards (enhanced with stats) ---- */
const getHomeCards = async (
  input: HomeCardsIn
): Promise<HomeCardsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/training/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Direct fetch for history data ---- */
const getHomeHistory = async (
  input: HomeHistoryIn
): Promise<HomeHistoryOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/attempt/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

async function createAttemptAction(
  input: CreateAttemptIn,
): Promise<CreateAttemptOut> {
  "use server";
  return api.post("/artifacts/attempt/create", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Home",
    description:
      "Comprehensive learning and development dashboard for graduate teaching assistants. Track simulation-based practice sessions, review pedagogical assessments, and monitor teaching performance metrics.",
  };
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // Parse search params via nuqs loader
  const q = loadHomeSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext, analyticsFilters } = await computeAnalyticsDefaults();
  const defaultFilters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Cards endpoint (now includes all stats needed for simulation cards)
  const cardsFilters: HomeCardsIn = {
    body: {
      practice: false,
    },
  };

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Fetch cards data (now includes all stats needed for simulation cards)
  const homeData = await getHomeCards(cardsFilters);

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  const historyKey = [
    historyPage,
    historyPageSize,
    historySearch || "",
    (historySimulationIds || []).join(","),
    (historyScenarioIds || []).join(","),
    historyInfiniteMode === undefined
      ? "all"
      : historyInfiniteMode
        ? "inf"
        : "std",
    historySortBy,
    historySortOrder,
    defaultFilters.startDate,
    defaultFilters.endDate,
    defaultFilters.cohortIds.join(","),
    defaultFilters.departmentIds.join(","),
    defaultFilters.roles.join(","),
    defaultFilters.simulationFilters.join(","),
  ].join("|");

  return (
    <div className="space-y-6">
      <Home homeData={homeData} createAttempt={createAttemptAction} />

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
            historySimulationIds={historySimulationIds}
            historyScenarioIds={historyScenarioIds}
            historyInfiniteMode={historyInfiniteMode}
            historySortBy={historySortBy}
            historySortOrder={historySortOrder}
            accessibleCohortIds={analyticsFilters?.cohort_options?.map(o => o.value) ?? []}
            accessibleDepartmentIds={analyticsFilters?.department_options?.map(o => o.value) ?? []}
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
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  accessibleCohortIds,
  accessibleDepartmentIds,
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
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  accessibleCohortIds: string[];
  accessibleDepartmentIds: string[];
}) {
  // Build history filters using /attempt/list endpoint
  // practice: false for home mode
  const historyFilters: HomeHistoryIn = {
    body: {
      practice: false,
      start_date: defaultFilters.startDate,
      end_date: defaultFilters.endDate,
      cohort_ids: defaultFilters.cohortIds,
      department_ids: defaultFilters.departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      show_archived: false,
      accessible_cohort_ids: accessibleCohortIds,
      accessible_department_ids: accessibleDepartmentIds,
      ...(historySearch && { search: historySearch }),
      ...(historySimulationIds &&
        historySimulationIds.length > 0 && {
          simulation_ids: historySimulationIds,
        }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          scenario_ids: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        infinite_mode: historyInfiniteMode,
      }),
      sort_by: historySortBy,
      sort_order: historySortOrder,
    },
  };

  const historyData = await getHomeHistory(historyFilters);

  // Home history data is never archived (MV filters out archived)
  const dataArray = historyData.data || [];
  const archivedCount = 0;
  const unarchivedCount = dataArray.length;

  // Extract options from API response
  const profileOptions: { value: string; label: string; count?: number }[] = [];
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt) => {
      const count = typeof opt.count === "number" ? opt.count : undefined;
      return {
        value: String(opt.value || ""),
        label: String(opt.label || ""),
        ...(count !== undefined && { count }),
      };
    }
  );
  const scenarioOptions = (historyData.scenario_options || []).map((opt: { value?: string | null; label?: string | null; count?: number | null }) => {
    const count = typeof opt.count === "number" ? opt.count : undefined;
    return {
      value: String(opt.value || ""),
      label: String(opt.label || ""),
      ...(count !== undefined && { count }),
    };
  });

  return (
    <SimulationHistory
      data={dataArray}
      totalCount={historyData.total_count || 0}
      archivedCount={archivedCount}
      unarchivedCount={unarchivedCount}
      pageIndex={historyPage}
      pageSize={historyPageSize}
      showExport={true}
      showArchive={false}
      singleProfile={true}
      initialFilters={defaultFilters}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeHistoryIn, HomeHistoryOut, HomeOut };
