/**
 * app/(main)/leaderboard/page.tsx
 * Root-level leaderboard page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Leaderboard from "@/components/artifacts/leaderboard/Leaderboard";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadLeaderboardSearchParams } from "@/lib/search-params/leaderboard";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/attempt/leaderboard/get", "post">;
type LeaderboardOut = OutputOf<"/attempt/leaderboard/get", "post">;
type LeaderboardSearchIn = InputOf<"/attempt/leaderboard/search", "post">;
type LeaderboardSearchOut = OutputOf<"/attempt/leaderboard/search", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type GroupLeaderboardIn = InputOf<"/attempt/group", "post">;
type GroupLeaderboardOut = OutputOf<"/attempt/group", "post">;
type ProblemLeaderboardIn = InputOf<"/attempt/problem", "post">;
type ProblemLeaderboardOut = OutputOf<"/attempt/problem", "post">;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Leaderboard responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getLeaderboard = async (
  input: LeaderboardIn
): Promise<LeaderboardOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/attempt/leaderboard/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function refreshLeaderboard(): Promise<void> {
  "use server";
  await api.post("/attempt/leaderboard/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportLeaderboard(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/attempt/export" as Parameters<typeof api.post>[0],
    { body: { view: "leaderboard" } as unknown as InputOf<"/attempt/export", "post"> },
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function createLeaderboardProblem(input: ProblemLeaderboardIn): Promise<ProblemLeaderboardOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

async function searchLeaderboardRows(input: LeaderboardSearchIn): Promise<LeaderboardSearchOut> {
  "use server";
  return api.post("/attempt/leaderboard/search", input);
}

/** ---- GenerationPanel server actions ---- */
async function getAttemptGroup(input: GroupLeaderboardIn): Promise<GroupLeaderboardOut> {
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
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Leaderboard" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface LeaderboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
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
    guardPage("/leaderboard", context.profile.role_permissions);

    // Parse search params via nuqs loader
    const q = loadLeaderboardSearchParams(await searchParams);
    const simulationFilters = q.simulationFilters ?? ["general"];

    // Read view cookie for column visibility
    const initialColumnVisibility = await readViewCookie("leaderboard");

    const leaderboardSearchInput = {
      body: {
        ...(q.startDate && { start_date: q.startDate }),
        ...(q.endDate && { end_date: q.endDate }),
        ...(q.cohortIds?.length && { cohort_ids: q.cohortIds }),
        ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
        simulation_filters: simulationFilters,
        sort_by: "highest_score",
        sort_order: "desc",
        page_limit: 50,
        page_offset: 0,
      },
    } as LeaderboardSearchIn;

    // Fetch leaderboard section data and group in parallel. Rows are loaded
    // through the server action passed to the client component.
    const [leaderboardData, groupResult] = await Promise.all([
      getLeaderboard({
        body: {
          ...(q.startDate && { start_date: q.startDate }),
          ...(q.endDate && { end_date: q.endDate }),
          ...(q.cohortIds?.length && { cohort_ids: q.cohortIds }),
          ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
          simulation_filters: simulationFilters,
        },
      }),
      api.post(
        "/attempt/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupLeaderboardIn,
      ),
    ]);

    // Compute initial filters from inline facets
    const facets = leaderboardData.analytics;

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        {...(initialSidebarOpen !== undefined && { initialSidebarOpen })}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "leaderboard",
          createFeedback: createLeaderboardProblem as unknown as (
            input: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>,
        }}
        breadcrumbs={[
          { title: "Leaderboard", section: "leaderboard", url: "/leaderboard" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshLeaderboard}
            analyticsFilters={facets}
            exportAction={exportLeaderboard}
            bffDownloadPrefix="/api/attempt/download"
          />
        }
        panelProps={{
          artifactType: "leaderboard",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupLeaderboardOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupLeaderboardOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          ...(context.prompts?.prompts && { prompts: context.prompts.prompts }),
          getGroupAction: getAttemptGroup as unknown as NonNullable<
            PanelProps["getGroupAction"]
          >,
          searchGenerationsAction:
            searchAttemptGenerations as unknown as NonNullable<
              PanelProps["searchGenerationsAction"]
            >,
        }}
      >
        <div className="space-y-6 px-4" data-page="leaderboard-index">
          <Leaderboard
            leaderboardData={leaderboardData}
            searchLeaderboardAction={searchLeaderboardRows}
            initialSearchInput={leaderboardSearchInput}
            {...(initialColumnVisibility && { initialColumnVisibility })}
          />
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
      // 401 → not logged in. /leaderboard has no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/leaderboard"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut, LeaderboardSearchIn, LeaderboardSearchOut };
