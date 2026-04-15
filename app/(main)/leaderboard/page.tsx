/**
 * app/(main)/leaderboard/page.tsx
 * Root-level leaderboard page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import Leaderboard from "@/components/artifacts/leaderboard/Leaderboard";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadLeaderboardSearchParams } from "@/lib/search-params/leaderboard";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/leaderboard/get", "post">;
type LeaderboardOut = OutputOf<"/leaderboard/get", "post">;
type GenerateLeaderboardIn = InputOf<"/leaderboard/generate", "post">;
type GenerateLeaderboardOut = OutputOf<"/leaderboard/generate", "post">;
type GenerationsIn = InputOf<"/leaderboard/generations", "post">;
type GenerationsOut = OutputOf<"/leaderboard/generations", "post">;
type GroupLeaderboardIn = InputOf<"/leaderboard/group", "post">;
type GroupLeaderboardOut = OutputOf<"/leaderboard/group", "post">;
type ProblemLeaderboardIn = InputOf<"/leaderboard/problem", "post">;
type ProblemLeaderboardOut = OutputOf<"/leaderboard/problem", "post">;
type ContextIn = InputOf<"/leaderboard/context", "post">;
type ContextOut = OutputOf<"/leaderboard/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Leaderboard responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getLeaderboard = async (
  input: LeaderboardIn
): Promise<LeaderboardOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/leaderboard/get", input, {
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
  await api.post("/leaderboard/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function generateLeaderboard(
  input: GenerateLeaderboardIn
): Promise<GenerateLeaderboardOut> {
  "use server";
  return api.post("/leaderboard/generate", input);
}

async function getLeaderboardGroupHistory(groupId: string): Promise<GroupLeaderboardOut> {
  "use server";
  return api.post("/leaderboard/group", { body: { group_id: groupId } } as GroupLeaderboardIn);
}

async function searchLeaderboardGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/leaderboard/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createLeaderboardProblem(input: ProblemLeaderboardIn): Promise<ProblemLeaderboardOut> {
  "use server";
  return api.post("/leaderboard/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/leaderboard/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
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

  // Profile data for providers
  const context = await api.post("/leaderboard/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params via nuqs loader
  const q = loadLeaderboardSearchParams(await searchParams);

  // Read view cookie for column visibility
  const initialColumnVisibility = await readViewCookie("leaderboard");

  // Fetch leaderboard data and group in parallel
  const [leaderboardData, groupResult] = await Promise.all([
    getLeaderboard({
      body: {
        start_date: q.startDate ?? undefined,
        end_date: q.endDate ?? undefined,
        cohort_ids: q.cohortIds ?? undefined,
        department_ids: q.departmentIds ?? undefined,
        simulation_filters: q.simulationFilters ?? undefined,
        sort_by: "highest_score",
        sort_order: "desc",
        page_limit: 50,
        page_offset: 0,
      },
    }),
    api.post("/leaderboard/group", { body: {} } as GroupLeaderboardIn),
  ]);

  // Compute initial filters from inline facets
  const facets = leaderboardData.analytics;

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "leaderboard",
        createFeedback: createLeaderboardProblem,
      }}
      breadcrumbs={[
        { title: "Leaderboard", section: "leaderboard", url: "/leaderboard" },
      ]}
      toolbar={
        <AnalyticsFilters
          refreshAction={refreshLeaderboard}
          analyticsFilters={facets}
        />
      }
      panelProps={{
        artifactType: "leaderboard",
        groupId: (groupResult as GroupLeaderboardOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateLeaderboard,
        permissions: [
          { artifact: "leaderboard", operation: "draft" },
          { artifact: "leaderboard", operation: "get" },
          { artifact: "leaderboard", operation: "docs" },
          { artifact: "leaderboard", operation: "group" },
        ],
        getGroupHistory: getLeaderboardGroupHistory,
        searchGroups: searchLeaderboardGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="leaderboard-index">
        <Leaderboard leaderboardData={leaderboardData} initialColumnVisibility={initialColumnVisibility} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut };
