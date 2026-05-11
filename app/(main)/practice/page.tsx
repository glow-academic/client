/**
 * app/(main)/practice/page.tsx
 * Practice page for the user — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import SimulationHistory from "@/components/common/SimulationHistory";
import Practice from "@/components/artifacts/practice/Practice";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadPracticeSearchParams } from "@/lib/search-params/practice";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/attempt/practice/get", "post">;
type PracticeOut = OutputOf<"/attempt/practice/get", "post">;
type PracticeHistoryOut = NonNullable<PracticeOut["history"]>;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GroupIn = InputOf<"/attempt/group", "post">;
type GroupOut = OutputOf<"/attempt/group", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type ProblemIn = InputOf<"/attempt/problem", "post">;
type ProblemOut = OutputOf<"/attempt/problem", "post">;

/** ---- Direct fetch for practice data (cards + embedded history) ---- */
const getPracticeData = async (input: PracticeIn): Promise<PracticeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/attempt/practice/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function refreshChat(): Promise<void> {
  "use server";
  await api.post("/chat/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportPractice(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/attempt/export" as Parameters<typeof api.post>[0],
    { body: { view: "practice" } as unknown as InputOf<"/attempt/export", "post"> },
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function createPracticeProblem(input: ProblemIn): Promise<ProblemOut> {
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
      title: "Practice",
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Practice" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface PracticePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PracticePage({
  searchParams,
}: PracticePageProps) {
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
  guardPage("/practice", context.profile.role_permissions);

  // Parse search params via nuqs loader
  const q = loadPracticeSearchParams(await searchParams);

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
  type SearchIn = InputOf<"/attempt/practice/search", "post">;
  type SearchOut = OutputOf<"/attempt/practice/search", "post">;
  const [practiceData, historyResult, groupResult] = await Promise.all([
    getPracticeData({ body: {} }),
    api.post("/attempt/practice/search", {
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
    api.post(
      "/attempt/group",
      { body: q.groupId ? { group_id: q.groupId } : {} } as GroupIn,
    ),
  ]);

  // Check if user is a guest (no items means no access / guest)
  const isGuest = !practiceData.items || practiceData.items.length === 0;

  // Compute initial filters from inline facets (replaces computeAnalyticsDefaults)
  const facets = practiceData.analytics;
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

  // History from separate search endpoint
  const historyData = historyResult || {
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
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "practice",
        createFeedback: createPracticeProblem,
      }}
      breadcrumbs={[
        { title: "Practice", section: "practice", url: "/practice" },
      ]}
      toolbar={
        <AnalyticsFilters
          refreshAction={refreshChat}
          analyticsFilters={facets}
          exportAction={exportPractice}
          bffDownloadPrefix="/api/attempt/download"
        />
      }
      panelProps={{
        artifactType: "attempt",
          initialPanelPrefs: await readGenerationPanelPrefs(),
        groupId: (groupResult as GroupOut & { group_id?: string })?.group_id ?? null,
        groupName:
          (groupResult as GroupOut & { name?: string | null })?.name ?? null,
        // Forward the full SSR-fetched group payload — the panel
        // seeds historicalMessages from this synchronously and
        // skips the duplicate client-side /<art>/group refetch
        // on first paint, eliminating the hydration flicker.
        initialGroupHistory: groupResult as Record<string, unknown>,
        operations: ["draft", "get", "title"],
        prompts: context.prompts?.prompts,
        getGroupAction: getAttemptGroup as PanelProps["getGroupAction"],
        searchGenerationsAction:
          searchAttemptGenerations as PanelProps["searchGenerationsAction"],
      }}
    >
      <div className="space-y-6 px-4">
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
              showArchive={false}
              singleProfile={true}
              initialFilters={initialFilters}
              profileOptions={profileOptions}
              simulationOptions={simulationOptions}
              scenarioOptions={scenarioOptions}
              showModeFilter={true}
              initialColumnVisibility={await readViewCookie("history")}
            />
          </div>
        )}
      </div>
    </FullPageLayout>
  );

  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      // 401 → not logged in. /practice has no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/practice"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeHistoryOut, PracticeOut };
