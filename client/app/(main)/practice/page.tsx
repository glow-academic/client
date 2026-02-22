/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/artifacts/attempt/history/SimulationHistory";
import Practice from "@/components/artifacts/attempt/Practice";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadPracticeSearchParams } from "@/lib/search-params/practice";

/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/api/v4/artifacts/practice/get", "post">;
type PracticeOut = OutputOf<"/api/v4/artifacts/practice/get", "post">;
type PracticeHistoryOut = NonNullable<PracticeOut["history"]>;

/** ---- Direct fetch for practice data (cards + embedded history) ---- */
const getPracticeData = async (input: PracticeIn): Promise<PracticeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/practice/get", input, {
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

  // Compute defaults and resolve filters (same as home page)
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const defaultFilters = resolveAnalyticsFilters(q, defaults, profileContext);

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Check if user is a guest
  const isGuest = !profileContext.id || profileContext.role === "guest";

  // Single fetch: cards + embedded history
  const practiceData = await getPracticeData({
    body: {
      history_page: historyPage,
      history_page_size: historyPageSize,
      history_sort_by: historySortBy,
      history_sort_order: historySortOrder,
      ...(historySearch && { history_simulation_search: historySearch }),
      ...(historyScenarioIds &&
        historyScenarioIds.length > 0 && {
          history_scenario_ids: historyScenarioIds,
        }),
      ...(historyInfiniteMode !== undefined && {
        history_infinite_mode: historyInfiniteMode,
      }),
    },
  });

  // Extract history from embedded response
  const historyData: PracticeHistoryOut = practiceData.history || {
    data: [],
    total_count: 0,
    page: 0,
    page_size: historyPageSize,
    total_pages: 0,
  };

  // Calculate archived/unarchived counts from data
  const dataArray = historyData.data || [];
  const archivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => item.is_archived).length;
  const unarchivedCount = dataArray.filter((item: { is_archived?: boolean | null }) => !item.is_archived).length;

  // Extract options from embedded history response
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
    <div className="space-y-6">
      <Practice practiceData={practiceData} isGuest={isGuest} />

      {/* History section — data from embedded practice/get response, only show for non-guests */}
      {!isGuest && (
        <div className="mt-12">
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
          />
        </div>
      )}
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryOut, PracticeOut };
