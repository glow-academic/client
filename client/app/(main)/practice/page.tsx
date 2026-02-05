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
import type { Metadata } from "next";
import { Suspense } from "react";
import { getLayoutContext } from "../layout-server";
import { loadPracticeSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
// Using /training/get for simulation cards (enhanced with stats)
type PracticeCardsIn = InputOf<"/api/v4/training/get", "post">;
type PracticeCardsOut = OutputOf<"/api/v4/training/get", "post">;
// Using /attempt/list for history section
type PracticeHistoryIn = InputOf<"/api/v4/attempt/list", "post">;
type PracticeHistoryOut = OutputOf<"/api/v4/attempt/list", "post">;

// Practice component uses cards data directly (no merge needed)
type PracticeOut = PracticeCardsOut;

/** ---- Direct fetch for simulation cards (enhanced with stats) ---- */
const getPracticeCards = async (
  input: PracticeCardsIn
): Promise<PracticeCardsOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/training/get", input, {
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

  return api.post("/attempt/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
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
  // Parse search params via nuqs loader
  const q = loadPracticeSearchParams(await searchParams);

  // Get profileId and departmentIds from profile context with resolved UUIDs
  let profileContext;
  try {
    profileContext = await getLayoutContext({
      body: {},
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 401
    ) {
      throw error;
    }
    throw error;
  }

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

  // Get profileId from profile context
  const profileId = profileContext.id;

  // Check if user is a guest
  const isGuest = !profileId || profileContext.role === "guest";

  // Create historyKey for Suspense boundary to trigger re-fetch on URL param changes
  const analyticsStartDate = q.startDate || "";
  const analyticsEndDate = q.endDate || "";
  const analyticsCohortIds = (q.cohortIds || []).join(",");
  const analyticsDepartmentIds = (q.departmentIds || []).join(",");
  const analyticsRoles = (q.roles || []).join(",");
  const analyticsSimulationFilters = (q.simulationFilters || ["general"]).join(",");
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
    analyticsStartDate,
    analyticsEndDate,
    analyticsCohortIds,
    analyticsDepartmentIds,
    analyticsRoles,
    analyticsSimulationFilters,
  ].join("|");

  return (
    <div className="space-y-6">
      <Practice practiceData={practiceData} isGuest={isGuest} />

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
              historySimulationIds={historySimulationIds}
              historyScenarioIds={historyScenarioIds}
              historyInfiniteMode={historyInfiniteMode}
              historySortBy={historySortBy}
              historySortOrder={historySortOrder}
              departmentIds={profileContext.department_ids || []}
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
  historySimulationIds,
  historyScenarioIds,
  historyInfiniteMode,
  historySortBy,
  historySortOrder,
  departmentIds,
}: {
  historyPage: number;
  historyPageSize: number;
  historySearch?: string | undefined;
  historySimulationIds?: string[] | undefined;
  historyScenarioIds?: string[] | undefined;
  historyInfiniteMode?: boolean | undefined;
  historySortBy: string;
  historySortOrder: string;
  departmentIds: string[];
}) {
  // Default date range: last year
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const historyFilters: PracticeHistoryIn = {
    body: {
      practice: true,
      start_date: oneYearAgo.toISOString(),
      end_date: now.toISOString(),
      department_ids: departmentIds,
      page: historyPage,
      page_size: historyPageSize,
      show_archived: false,
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
    />
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryIn, PracticeHistoryOut, PracticeOut };
