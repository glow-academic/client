/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/history/SimulationHistory";
import Practice from "@/components/practice/Practice";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadPracticeSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
// Using /training/get for simulation cards (enhanced with stats)
type PracticeCardsIn = InputOf<"/api/v4/artifacts/training/get", "post">;
type PracticeCardsOut = OutputOf<"/api/v4/artifacts/training/get", "post">;
// Using /attempt/list for history section
type PracticeHistoryIn = InputOf<"/api/v4/artifacts/attempt/list", "post">;
type PracticeHistoryOut = OutputOf<"/api/v4/artifacts/attempt/list", "post">;
// Using /attempt/create for starting training
type CreateAttemptIn = InputOf<"/api/v4/artifacts/attempt/create", "post">;
type CreateAttemptOut = OutputOf<"/api/v4/artifacts/attempt/create", "post">;

// Practice component uses cards data directly (no merge needed)
type PracticeOut = PracticeCardsOut;

/** ---- Direct fetch for simulation cards (enhanced with stats) ---- */
const getPracticeCards = async (
  input: PracticeCardsIn
): Promise<PracticeCardsOut> => {
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
const getPracticeHistory = async (
  input: PracticeHistoryIn
): Promise<PracticeHistoryOut> => {
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
  // Parse search params via nuqs loader
  const q = loadPracticeSearchParams(await searchParams);

  // Compute defaults and resolve filters (same as home page)
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const defaultFilters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Cards endpoint (now includes all stats needed for simulation cards)
  const cardsFilters: PracticeCardsIn = {
    body: {
      practice: true,
    },
  };

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historyProfileIds = q.historyProfileIds ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Fetch cards data (now includes all stats needed for simulation cards)
  const practiceData = await getPracticeCards(cardsFilters);

  // Check if user is a guest
  const isGuest = !profileContext.id || profileContext.role === "guest";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
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
    defaultFilters.startDate,
    defaultFilters.endDate,
    defaultFilters.cohortIds.join(","),
    defaultFilters.departmentIds.join(","),
    defaultFilters.roles.join(","),
  ].join("|");

  return (
    <div className="space-y-6">
      <Practice practiceData={practiceData} isGuest={isGuest} createAttempt={createAttemptAction} />

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
                showCustomize={true}
              />
            }
          >
            <PracticeHistorySection
              defaultFilters={defaultFilters}
              historyPage={historyPage}
              historyPageSize={historyPageSize}
              historySearch={historySearch}
              historySimulationIds={historySimulationIds}
              historyScenarioIds={historyScenarioIds}
              historyInfiniteMode={historyInfiniteMode}
              historySortBy={historySortBy}
              historySortOrder={historySortOrder}
              accessibleCohortIds={profileContext.cohort_ids || []}
              accessibleDepartmentIds={profileContext.department_ids || []}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/** ---- Inline history section component (only used here) ---- */
async function PracticeHistorySection({
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
  const historyFilters: PracticeHistoryIn = {
    body: {
      practice: true,
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

  const historyData = await getPracticeHistory(historyFilters);

  // Calculate archived/unarchived counts from data
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  // Extract options from API response
  const profileOptions = (historyData.profile_options || []).map((opt: { value?: string | null; label?: string | null; count?: number | null }) => {
    const count = typeof opt.count === "number" ? opt.count : undefined;
    return {
      value: String(opt.value || ""),
      label: String(opt.label || ""),
      ...(count !== undefined && { count }),
    };
  });
  const simulationOptions = (historyData.simulation_options || []).map(
    (opt: { value?: string | null; label?: string | null; count?: number | null }) => {
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

  // Extract section-specific filter options from response
  const cohortFilterOptions = (historyData.cohort_options || []).map(
    (o: { value?: string | null; label?: string | null; count?: number | null }) => ({
      value: String(o.value || ""),
      label: o.label ?? null,
      count: typeof o.count === "number" ? o.count : null,
    })
  );
  const departmentFilterOptions = (historyData.department_options || []).map(
    (o: { value?: string | null; label?: string | null; count?: number | null }) => ({
      value: String(o.value || ""),
      label: o.label ?? null,
      count: typeof o.count === "number" ? o.count : null,
    })
  );

  return (
    <SimulationHistory
      data={dataArray}
      totalCount={historyData.total_count || 0}
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
      showCustomize={true}
      cohortFilterOptions={cohortFilterOptions}
      departmentFilterOptions={departmentFilterOptions}
      dateRangeEarliest={historyData.date_range_earliest ?? null}
      dateRangeLatest={historyData.date_range_latest ?? null}
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryIn, PracticeHistoryOut, PracticeOut };
