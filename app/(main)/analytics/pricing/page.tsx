/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { PricingRunsClient } from "@/components/artifacts/pricing/PricingRunsClient";
import { PricingSummary } from "@/components/artifacts/pricing/PricingSummary";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { loadPricingSearchParams } from "@/lib/search-params/pricing";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";


import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/system/pricing/get", "post">;
type PricingOut = OutputOf<"/system/pricing/get", "post">;
type PricingRunsOut = NonNullable<PricingOut["history"]>;

/** ---- Generation types ---- */
type ContextIn = InputOf<"/system/context", "post">;
type ContextOut = OutputOf<"/system/context", "post">;
type SystemGroupIn = InputOf<"/system/group", "post">;
type SystemGroupOut = OutputOf<"/system/group", "post">;
type SystemGenerationsIn = InputOf<"/system/generations", "post">;
type SystemGenerationsOut = OutputOf<"/system/generations", "post">;
type ProblemPricingIn = InputOf<"/system/problem", "post">;
type ProblemPricingOut = OutputOf<"/system/problem", "post">;

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSystemContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/system/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingAnalytics = async (input: PricingIn): Promise<PricingOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/system/pricing/get", input, {
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
    return { title: "Pricing" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface PricingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
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
    guardPage("/analytics/pricing", context.profile.role_permissions);

    // Parse search params via nuqs loader
    const q = loadPricingSearchParams(await searchParams);

    // Pricing-specific params with defaults
    const pricingPage = q.pricingPage ?? 0;
    const pricingPageSize = q.pricingPageSize ?? 10;
    const pricingModelIds = q.pricingModelIds ?? undefined;
    const pricingProfileIds = q.pricingProfileIds ?? undefined;
    const pricingActorIds = q.pricingActorIds ?? undefined;
    const pricingSearch = q.pricingSearch ?? undefined;
    const pricingSortBy = q.pricingSortBy ?? "date";
    const pricingSortOrder = q.pricingSortOrder ?? "desc";

    // Map frontend sort field to backend field name
    const sortBy = pricingSortBy === "createdAt" ? "date" : pricingSortBy;

    // Fetch pricing data, view cookie, and group in parallel
    const [pricingData, initialColumnVisibility, groupResult] = await Promise.all([
      getPricingAnalytics({
        body: {
          ...(q.startDate && { start_date: q.startDate }),
          ...(q.endDate && { end_date: q.endDate }),
          ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
          page_limit: 100,
          page_offset: 0,
          // Embedded group history params
          history_page: pricingPage,
          history_page_size: pricingPageSize,
          history_sort_by: sortBy,
          history_sort_order: pricingSortOrder,
          // Multi-model filter (server takes precedence over legacy
          // singular `history_model_id`). We send the array shape so all
          // selected models filter pricing rows together.
          ...(pricingModelIds?.length && {
            history_model_ids: pricingModelIds,
          }),
          // Profile = human user; actor = LLM agent. Distinct server filters
          // mirror the existing column accessors in RunsDataTable.
          ...(pricingProfileIds?.length && {
            history_profile_ids: pricingProfileIds,
          }),
          ...(pricingActorIds?.length && {
            history_agent_ids: pricingActorIds,
          }),
          ...(pricingSearch && { history_search: pricingSearch }),
        },
      }),
      readViewCookie("pricing"),
      api.post(
        "/system/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as SystemGroupIn,
      ),
    ]);

    // Extract inline analytics facets
    const facets = pricingData.analytics;

    // Extract embedded history or use empty fallback
    const runsData: PricingRunsOut = pricingData.history ?? {
      items: [],
      total_count: 0,
      page: pricingPage,
      page_size: pricingPageSize,
      total_pages: 0,
    };

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        {...(initialSidebarOpen !== undefined && { initialSidebarOpen })}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "pricing",
          createFeedback: createPricingProblem as unknown as (
            input: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>,
        }}
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Pricing" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshPricing}
            analyticsFilters={facets}
            exportAction={exportPricing}
            bffDownloadPrefix="/api/system/download"
          />
        }
        panelProps={{
          artifactType: "pricing",
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
          ...(context.prompts?.prompts && { prompts: context.prompts.prompts }),
          getGroupAction: getSystemGroup as unknown as NonNullable<
            PanelProps["getGroupAction"]
          >,
          searchGenerationsAction: searchSystemGenerations as unknown as NonNullable<
            PanelProps["searchGenerationsAction"]
          >,
        }}
      >
        <div className="space-y-6 px-4" data-page="pricing-index">
          <PricingSummary pricingData={pricingData} />
          <PricingRunsClient
            runsData={runsData}
            isLoading={false}
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
      // 401 → not logged in. Analytics pages have no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/analytics/pricing"
        />
      );
    }
    throw error;
  }
}

/** ---- Strongly-typed server actions ---- */
async function refreshPricing(): Promise<void> {
  "use server";
  await api.post("/system/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportPricing(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/system/export" as Parameters<typeof api.post>[0],
    { body: { view: "pricing" } } as unknown as Parameters<typeof api.post>[1],
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function getSystemGroup(input: SystemGroupIn): Promise<SystemGroupOut> {
  "use server";
  return api.post("/system/group", input);
}

async function searchSystemGenerations(input: SystemGenerationsIn): Promise<SystemGenerationsOut> {
  "use server";
  return api.post("/system/generations", input);
}


async function createPricingProblem(input: ProblemPricingIn): Promise<ProblemPricingOut> {
  "use server";
  return api.post("/system/problem", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut, PricingRunsOut };
