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
import { refreshPage } from "@/app/(main)/layout-server";
import { getLayoutContextData } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cache } from "react";
import { cookies } from "next/headers";
import { loadHealthSearchParams } from "@/lib/search-params/health";

/** ---- Strong types from OpenAPI ---- */
type HealthBundleIn = InputOf<"/health/get", "post">;
type HealthBundleOut = OutputOf<"/health/get", "post">;
type ContextIn = InputOf<"/health/context", "post">;
type ContextOut = OutputOf<"/health/context", "post">;
type GenerateHealthIn = InputOf<"/health/generate", "post">;
type GenerateHealthOut = OutputOf<"/health/generate", "post">;
type GenerationsIn = InputOf<"/health/generations", "post">;
type GenerationsOut = OutputOf<"/health/generations", "post">;
type GroupHealthIn = InputOf<"/health/group", "post">;
type GroupHealthOut = OutputOf<"/health/group", "post">;
type ProblemHealthIn = InputOf<"/health/problem", "post">;
type ProblemHealthOut = OutputOf<"/health/problem", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHealthBundle = cache(
  async (input: HealthBundleIn): Promise<HealthBundleOut> => {
    const bypassCache = await isHardRefresh();

    return api.post("/health/get", input, {
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
async function generateHealth(
  input: GenerateHealthIn
): Promise<GenerateHealthOut> {
  "use server";
  return api.post("/health/generate", input);
}

async function getHealthGroupHistory(groupId: string): Promise<GroupHealthOut> {
  "use server";
  return api.post("/health/group", { body: { group_id: groupId } } as GroupHealthIn);
}

async function searchHealthGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/health/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createHealthProblem(input: ProblemHealthIn): Promise<ProblemHealthOut> {
  "use server";
  return api.post("/health/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/health/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
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

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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
    api.post("/health/group", { body: {} } as GroupHealthIn),
  ]);

  // Extract inline analytics facets
  const facets = bundleData.analytics;

  return (
    <FullPageLayout
      profileData={profileData}
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
          refreshPage={refreshPage}
          analyticsFilters={facets}
        />
      }
      panelProps={{
        artifactType: "health",
        groupId: (groupResult as GroupHealthOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateHealth,
        permissions: [
          { artifact: "health", operation: "draft" },
          { artifact: "health", operation: "get" },
          { artifact: "health", operation: "docs" },
          { artifact: "health", operation: "group" },
        ],
        getGroupHistory: getHealthGroupHistory,
        searchGroups: searchHealthGroups,
      }}
    >
      <div className="space-y-6 px-4">
        <Logs bundleData={bundleData} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HealthBundleIn, HealthBundleOut };
