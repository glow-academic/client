/**
 * app/(main)/home/page.tsx
 * Home page for the user — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import SimulationHistory from "@/components/common/SimulationHistory";
import Home from "@/components/artifacts/home/Home";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadHomeSearchParams } from "@/lib/search-params/home";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/attempt/home/get", "post">;
type HomeOut = OutputOf<"/attempt/home/get", "post">;
type HomeHistoryOut = NonNullable<HomeOut["history"]>;
type ContextIn = InputOf<"/attempt/home/context", "post">;
type ContextOut = OutputOf<"/attempt/home/context", "post">;
type GenerateHomeIn = InputOf<"/attempt/home/generate", "post">;
type GenerateHomeOut = OutputOf<"/attempt/home/generate", "post">;
type GenerationsIn = InputOf<"/attempt/home/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/home/generations", "post">;
type GroupHomeIn = InputOf<"/attempt/home/group", "post">;
type GroupHomeOut = OutputOf<"/attempt/home/group", "post">;
type ProblemHomeIn = InputOf<"/attempt/home/problem", "post">;
type ProblemHomeOut = OutputOf<"/attempt/home/problem", "post">;

/** ---- Direct fetch for home data (cards + embedded history) ---- */
const getHomeData = async (input: HomeIn): Promise<HomeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/attempt/home/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function refreshHome(): Promise<void> {
  "use server";
  await api.post("/attempt/home/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function generateHome(
  input: GenerateHomeIn
): Promise<GenerateHomeOut> {
  "use server";
  return api.post("/attempt/home/generate", input);
}

async function getHomeGroupHistory(groupId: string): Promise<GroupHomeOut> {
  "use server";
  return api.post("/attempt/home/group", { body: { group_id: groupId } } as GroupHomeIn);
}

async function searchHomeGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/home/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createHomeProblem(input: ProblemHomeIn): Promise<ProblemHomeOut> {
  "use server";
  return api.post("/attempt/home/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/attempt/home/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title ?? "Home",
      description: context.page_metadata?.list.description ??
        "Comprehensive learning and development dashboard for graduate teaching assistants. Track simulation-based practice sessions, review pedagogical assessments, and monitor teaching performance metrics.",
    };
  } catch {
    return { title: "Home" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
  // Profile data for providers
  const context = await api.post("/attempt/home/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params via nuqs loader
  const q = loadHomeSearchParams(await searchParams);

  // History params with defaults
  const historyPage = q.historyPage ?? 0;
  const historyPageSize = q.historyPageSize ?? 10;
  const historySearch = q.historySearch ?? undefined;
  const _historySimulationIds = q.historySimulationIds ?? undefined;
  const historyScenarioIds = q.historyScenarioIds ?? undefined;
  const historyInfiniteMode = q.historyInfiniteMode ?? undefined;
  const historySortBy = q.historySortBy ?? "date";
  const historySortOrder = q.historySortOrder ?? "desc";

  // Single fetch: cards + embedded history + group in parallel
  const [homeData, groupResult] = await Promise.all([
    getHomeData({
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
    }),
    api.post("/attempt/home/group", { body: {} } as GroupHomeIn),
  ]);

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

  // Compute initial filters from inline facets (replaces computeAnalyticsDefaults)
  const facets = homeData.analytics;
  const defaultStartDate = (() => {
    if (q.startDate) return q.startDate;
    if (facets?.date_range_earliest) {
      const d = new Date(facets.date_range_earliest);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const defaultEndDate = (() => {
    if (q.endDate) return q.endDate;
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();
  const initialFilters = {
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    cohortIds: q.cohortIds ?? [],
    departmentIds: q.departmentIds ?? [],
    roles: q.roles ?? [],
  };

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "home",
        createFeedback: createHomeProblem,
      }}
      breadcrumbs={[
        { title: "Home", section: "home", url: "/home" },
      ]}
      toolbar={
        <AnalyticsFilters
          refreshAction={refreshHome}
          analyticsFilters={facets}
        />
      }
      panelProps={{
        artifactType: "home",
        groupId: (groupResult as GroupHomeOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateHome,
        operations: ["draft", "get", "group"],
        getGroupHistory: getHomeGroupHistory,
        searchGroups: searchHomeGroups,
        prompts: context.prompts?.prompts,
      }}
    >
      <div className="space-y-6 px-4">
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
            showArchive={false}
            singleProfile={true}
            initialFilters={initialFilters}
            profileOptions={profileOptions}
            simulationOptions={simulationOptions}
            scenarioOptions={scenarioOptions}
            initialColumnVisibility={await readViewCookie("history")}
          />
        </div>
      </div>
    </FullPageLayout>
  );

  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/home"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeHistoryOut, HomeOut };
