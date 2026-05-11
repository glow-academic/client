/**
 * app/(main)/health/page.tsx
 * System health page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import Logs from "@/components/artifacts/health/Logs";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cache } from "react";
import { cookies } from "next/headers";
import { loadHealthSearchParams } from "@/lib/search-params/health";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";

/** ---- Strong types from OpenAPI ---- */
type HealthBundleIn = InputOf<"/system/health", "post">;
type HealthBundleOut = OutputOf<"/system/health", "post">;
type ContextIn = InputOf<"/system/context", "post">;
type ContextOut = OutputOf<"/system/context", "post">;
type SystemGroupIn = InputOf<"/system/group", "post">;
type SystemGroupOut = OutputOf<"/system/group", "post">;
type SystemGenerationsIn = InputOf<"/system/generations", "post">;
type SystemGenerationsOut = OutputOf<"/system/generations", "post">;
type ProblemHealthIn = InputOf<"/system/problem", "post">;
type ProblemHealthOut = OutputOf<"/system/problem", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHealthBundle = cache(
  async (input: HealthBundleIn): Promise<HealthBundleOut> => {
    const bypassCache = await isHardRefresh();

    return api.post("/system/health", input, {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    });
  },
);

/** ---- Strongly-typed server actions ---- */
async function refreshHealth(): Promise<void> {
  "use server";
  await api.post("/system/health/refresh" as Parameters<typeof api.post>[0], { body: {} });
}

async function exportHealth(): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/system/export" as Parameters<typeof api.post>[0],
    { body: { view: "health" } } as unknown as Parameters<typeof api.post>[1],
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function createHealthProblem(input: ProblemHealthIn): Promise<ProblemHealthOut> {
  "use server";
  return api.post("/system/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getSystemGroup(input: SystemGroupIn): Promise<SystemGroupOut> {
  "use server";
  return api.post("/system/group", input);
}

async function searchSystemGenerations(input: SystemGenerationsIn): Promise<SystemGenerationsOut> {
  "use server";
  return api.post("/system/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSystemContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/system/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getSystemContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Health" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface HealthPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HealthPage({ searchParams }: HealthPageProps) {
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
    guardPage("/health", context.profile.role_permissions);

    // Parse search params via nuqs loader
    const q = loadHealthSearchParams(await searchParams);

    // Fetch bundle data and group in parallel
    const [bundleData, groupResult] = await Promise.all([
      getHealthBundle({
        body: {
          date_from: q.startDate ?? undefined,
          date_to: q.endDate ?? undefined,
        },
      }),
      api.post(
        "/system/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as SystemGroupIn,
      ),
    ]);

    // Extract inline analytics facets
    const facets = bundleData.analytics;

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "health",
          createFeedback: createHealthProblem,
        }}
        breadcrumbs={[
          { title: "Health" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshAction={refreshHealth}
            analyticsFilters={facets}
            exportAction={exportHealth}
            bffDownloadPrefix="/api/system/download"
          />
        }
        panelProps={{
          artifactType: "health",
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
        <div className="space-y-6 px-4">
          <Logs bundleData={bundleData} />
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
      // 401 → not logged in. /health has no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/health"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HealthBundleIn, HealthBundleOut };
