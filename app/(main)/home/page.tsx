/**
 * app/(main)/home/page.tsx
 * Home page for the user — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import SimulationHistory from "@/components/common/SimulationHistory";
import Home from "@/components/artifacts/home/Home";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadHomeSearchParams } from "@/lib/search-params/home";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/attempt/home/get", "post">;
type HomeOut = OutputOf<"/attempt/home/get", "post">;
type HomeHistoryOut = NonNullable<HomeOut["history"]>;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GroupIn = InputOf<"/attempt/group", "post">;
type GroupOut = OutputOf<"/attempt/group", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type ProblemIn = InputOf<"/attempt/problem", "post">;
type ProblemOut = OutputOf<"/attempt/problem", "post">;

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

async function createHomeProblem(input: ProblemIn): Promise<ProblemOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getAttemptGroup(input: GroupIn): Promise<GroupOut> {
  "use server";
  return api.post("/attempt/group", input);
}

async function searchAttemptGenerations(
  input: GenerationsIn,
): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAttemptContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/attempt/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getAttemptContext();
    return {
      title: "Home",
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
  const context = await getAttemptContext();
  const snapshot = buildSnapshot(session, context.profile);
  guardPage("/home", context.profile.role_permissions);

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

  // Parallel fetch: cards + history search + group
  type SearchIn = InputOf<"/attempt/home/search", "post">;
  type SearchOut = OutputOf<"/attempt/home/search", "post">;
  const [homeData, historyResult, groupResult] = await Promise.all([
    getHomeData({ body: {} }),
    api.post("/attempt/home/search", {
      body: {
        page: historyPage,
        page_size: historyPageSize,
        sort_by: historySortBy,
        sort_order: historySortOrder,
        ...(historyScenarioIds &&
          historyScenarioIds.length > 0 && {
            scenario_ids: historyScenarioIds,
          }),
        ...(historyInfiniteMode !== undefined && {
          infinite_mode: historyInfiniteMode,
        }),
      },
    } as SearchIn) as SearchOut,
    // Honor an explicit `?groupId=` from the URL — that's the panel's
    // user-picked chat. Empty/null URL means default time-windowed
    // group, which the server resolves itself from {body: {}}.
    api.post(
      "/attempt/group",
      {
        body: q.groupId ? { group_id: q.groupId } : {},
      } as GroupIn,
    ),
  ]);

  // History from separate search endpoint
  const historyData = historyResult || {
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
        artifactType: "attempt",
          initialPanelPrefs: await readGenerationPanelPrefs(),
        groupId: (groupResult as GroupOut & { group_id?: string })?.group_id ?? null,
        groupName:
          (groupResult as GroupOut & { name?: string | null })?.name ?? null,
        operations: ["draft", "get", "title"],
        prompts: context.prompts?.prompts,
        getGroupAction: getAttemptGroup as PanelProps["getGroupAction"],
        searchGenerationsAction:
          searchAttemptGenerations as PanelProps["searchGenerationsAction"],
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
