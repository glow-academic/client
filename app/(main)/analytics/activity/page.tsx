/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Activity from "@/components/artifacts/activity/Activity";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadActivitySearchParams } from "@/lib/search-params/activity";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";


import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type ActivityBundleIn = InputOf<"/system/activity/get", "post">;
type ActivityBundleOut = OutputOf<"/system/activity/get", "post">;
type ActivityListOut = NonNullable<ActivityBundleOut["history"]>;

export type ActivityOut = {
  bundleData: ActivityBundleOut | null;
  activityData: ActivityListOut | null;
};

/** ---- Generation types ---- */
type ContextIn = InputOf<"/system/context", "post">;
type ContextOut = OutputOf<"/system/context", "post">;
type SystemGroupIn = InputOf<"/system/group", "post">;
type SystemGroupOut = OutputOf<"/system/group", "post">;
type SystemGenerationsIn = InputOf<"/system/generations", "post">;
type SystemGenerationsOut = OutputOf<"/system/generations", "post">;
type ProblemActivityIn = InputOf<"/system/problem", "post">;
type ProblemActivityOut = OutputOf<"/system/problem", "post">;

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSystemContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/system/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Direct fetch functions ---- */
const getActivityBundle = async (
  input: ActivityBundleIn
): Promise<ActivityBundleOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/system/activity/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getSystemContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Activity" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ActivityPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getSystemContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/analytics/activity", context.profile.role_permissions);

    // Parse search params via nuqs loader
    const q = loadActivitySearchParams(await searchParams);

    // Activity-specific params with defaults
    const activityPage = q.activityPage ?? 0;
    const activityPageSize = q.activityPageSize ?? 50;
    const roleIds = q.role_ids ?? q.roles ?? [];

    // Profile summary filter from search params
    const rawParams = await searchParams;
    const summaryProfileId = typeof rawParams["summaryProfileId"] === "string"
      ? rawParams["summaryProfileId"]
      : undefined;

    // Fetch bundle + embedded session history and group in parallel
    const [bundleData, groupResult] = await Promise.all([
      getActivityBundle({
        body: {
          ...(q.startDate && { date_from: q.startDate }),
          ...(q.endDate && { date_to: q.endDate }),
          ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
          ...(roleIds.length && { role_ids: roleIds }),
          page_limit: 50,
          page_offset: 0,
          ...(summaryProfileId && { summary_profile_id: summaryProfileId }),
          // Embedded session history params
          history_page: activityPage,
          history_page_size: activityPageSize,
          history_sort_by: "date",
          history_sort_order: "desc",
        },
      }),
      api.post(
        "/system/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as SystemGroupIn,
      ),
    ]);

    // Extract inline analytics facets from response
    const facets = bundleData.analytics;

    // Extract embedded history or use empty fallback
    const activityData: ActivityListOut = bundleData.history ?? {
      items: [],
      total_count: 0,
      page: activityPage,
      page_size: activityPageSize,
      total_pages: 0,
    };

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "activity",
          createFeedback: createActivityProblem,
        }}
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Activity" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshActivity}
            analyticsFilters={facets}
          />
        }
        panelProps={{
          artifactType: "activity",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as SystemGroupOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as SystemGroupOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getSystemGroup as PanelProps["getGroupAction"],
          searchGenerationsAction: searchSystemGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="activity-index">
          <Activity
            activityData={{
              bundleData,
              activityData,
            }}
            isLoading={false}
          />
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
          pathname="/analytics/activity"
        />
      );
    }
    throw error;
  }
}

/** ---- Strongly-typed server actions ---- */
async function refreshActivity(): Promise<void> {
  "use server";
  await api.post("/system/activity/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function getSystemGroup(input: SystemGroupIn): Promise<SystemGroupOut> {
  "use server";
  return api.post("/system/group", input);
}

async function searchSystemGenerations(input: SystemGenerationsIn): Promise<SystemGenerationsOut> {
  "use server";
  return api.post("/system/generations", input);
}


async function createActivityProblem(input: ProblemActivityIn): Promise<ProblemActivityOut> {
  "use server";
  return api.post("/system/problem", input);
}

/** ---- Export types for client (type-only imports) ---- */
export type { ActivityBundleIn, ActivityBundleOut, ActivityListOut };
