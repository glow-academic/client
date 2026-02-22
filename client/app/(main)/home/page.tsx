/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SimulationHistory from "@/components/common/SimulationHistory";
import Home from "@/components/artifacts/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadHomeSearchParams } from "@/lib/search-params/home";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/api/v4/artifacts/home/get", "post">;
type HomeOut = OutputOf<"/api/v4/artifacts/home/get", "post">;
type HomeHistoryOut = NonNullable<HomeOut["history"]>;

/** ---- Direct fetch for home data (cards + embedded history) ---- */
const getHomeData = async (input: HomeIn): Promise<HomeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/home/get", input, {
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

  // Single fetch: cards + embedded history
  const homeData = await getHomeData({
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
  const historyData: HomeHistoryOut = homeData.history || {
    data: [],
    total_count: 0,
    page: 0,
    page_size: historyPageSize,
    total_pages: 0,
  };

  // Home history data is never archived (MV filters out archived)
  const dataArray = historyData.data || [];
  const archivedCount = 0;
  const unarchivedCount = dataArray.length;

  // Extract options from embedded history response
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
    <div className="space-y-6">
      <Home homeData={homeData} />

      {/* History section — data from embedded home/get response */}
      <div className="mt-12">
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
      </div>
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeHistoryOut, HomeOut };
