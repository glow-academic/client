/**
 * app/(main)/health/page.tsx
 * System health page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import Logs from "@/components/artifacts/health/Logs";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { buildSnapshot } from "@/lib/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cache } from "react";
import { cookies } from "next/headers";
import { loadHealthSearchParams } from "@/lib/search-params/health";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

/** ---- Strong types from OpenAPI ---- */
type HealthBundleIn = InputOf<"/system/health/get", "post">;
type HealthBundleOut = OutputOf<"/system/health/get", "post">;
type ContextIn = InputOf<"/system/health/context", "post">;
type ContextOut = OutputOf<"/system/health/context", "post">;
type GenerateHealthIn = InputOf<"/system/health/generate", "post">;
type GenerateHealthOut = OutputOf<"/system/health/generate", "post">;
type GenerationsIn = InputOf<"/system/health/generations", "post">;
type GenerationsOut = OutputOf<"/system/health/generations", "post">;
type GroupHealthIn = InputOf<"/system/health/group", "post">;
type GroupHealthOut = OutputOf<"/system/health/group", "post">;
type ProblemHealthIn = InputOf<"/system/health/problem", "post">;
type ProblemHealthOut = OutputOf<"/system/health/problem", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHealthBundle = cache(
  async (input: HealthBundleIn): Promise<HealthBundleOut> => {
    const bypassCache = await isHardRefresh();

    return api.post("/system/health/get", input, {
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

async function generateHealth(
  input: GenerateHealthIn
): Promise<GenerateHealthOut> {
  "use server";
  return api.post("/system/health/generate", input);
}

async function getHealthGroupHistory(groupId: string): Promise<GroupHealthOut> {
  "use server";
  return api.post("/system/health/group", { body: { group_id: groupId } } as GroupHealthIn);
}

async function searchHealthGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/system/health/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createHealthProblem(input: ProblemHealthIn): Promise<ProblemHealthOut> {
  "use server";
  return api.post("/system/health/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/system/health/context", { body: {} } as ContextIn) as ContextOut;
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
    const context = await api.post("/system/health/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);

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
      api.post("/system/health/group", { body: {} } as GroupHealthIn),
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
          />
        }
        panelProps={{
          artifactType: "health",
          groupId: (groupResult as GroupHealthOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateHealth,
          operations: ["draft", "get", "group"],
          getGroupHistory: getHealthGroupHistory,
          searchGroups: searchHealthGroups,
          prompts: context.prompts?.prompts,
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
      (error.status === 401 || error.status === 403)
    ) {
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
