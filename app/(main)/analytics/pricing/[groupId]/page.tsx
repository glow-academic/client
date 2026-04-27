/**
 * app/(main)/analytics/pricing/[groupId]/page.tsx
 * Pricing group detail page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import Group from "@/components/artifacts/group/Group";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { loadPricingGroupSearchParams } from "@/lib/search-params/pricing-group";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/system/group/get", "post">;
type PricingGroupDetailOut = OutputOf<"/system/group/get", "post">;
type ContextIn = InputOf<"/system/context", "post">;
type ContextOut = OutputOf<"/system/context", "post">;
type SystemGroupIn = InputOf<"/system/group", "post">;
type SystemGroupOut = OutputOf<"/system/group", "post">;
type SystemGenerationsIn = InputOf<"/system/generations", "post">;
type SystemGenerationsOut = OutputOf<"/system/generations", "post">;
type SystemGenerateIn = InputOf<"/system/generate", "post">;
type SystemGenerateOut = OutputOf<"/system/generate", "post">;
type ProblemGroupIn = InputOf<"/system/problem", "post">;
type ProblemGroupOut = OutputOf<"/system/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingGroupDetail = async (
  input: PricingGroupDetailIn
): Promise<PricingGroupDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/system/group/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function getSystemGroup(input: SystemGroupIn): Promise<SystemGroupOut> {
  "use server";
  return api.post("/system/group", input);
}

async function searchSystemGenerations(input: SystemGenerationsIn): Promise<SystemGenerationsOut> {
  "use server";
  return api.post("/system/generations", input);
}

async function runSystemGenerate(input: SystemGenerateIn): Promise<SystemGenerateOut> {
  "use server";
  return api.post("/system/generate", input);
}

async function createGroupProblem(input: ProblemGroupIn): Promise<ProblemGroupOut> {
  "use server";
  return api.post("/system/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  try {
    const { groupId } = await params;
    const context = await api.post("/system/context", { body: { entity_id: groupId } } as ContextIn) as ContextOut;
    return { title: context.page_metadata?.detail.title, description: context.page_metadata?.detail.description };
  } catch {
    return { title: "Pricing Group" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function PricingGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { groupId } = await params;
  // `q.groupId` is the panel's user-picked generation group (URL query),
  // distinct from the route's `groupId` param which identifies the
  // pricing group entity being viewed.
  const q = loadPricingGroupSearchParams(await searchParams);
  const session = await getSession();

  if (!groupId) {
    return null;
  }

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const pageContext = await api.post("/system/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, pageContext.profile);

    const [groupDetail, context, genGroupResult] = await Promise.all([
      getPricingGroupDetail({
        body: {
          group_id: groupId,
        },
      }),
      api.post("/system/context", { body: { entity_id: groupId } } as ContextIn) as Promise<ContextOut>,
      api.post(
        "/system/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as SystemGroupIn,
      ),
    ]);

    const _entityName = context.page_metadata?.detail.title;

    return (
      <FullPageLayout
        profileData={pageContext.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "pricing",
          createFeedback: createGroupProblem,
        }}
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Pricing", section: "pricing", url: "/analytics/pricing" },
          { title: "Group" },
        ]}
        panelProps={{
          artifactType: "group",
          groupId: (genGroupResult as SystemGroupOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (genGroupResult as SystemGroupOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: genGroupResult as Record<string, unknown>,
          operations: ["draft", "get", "group"],
          prompts: context.prompts?.prompts,
          getGroupAction: getSystemGroup as PanelProps["getGroupAction"],
          searchGenerationsAction: searchSystemGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runSystemGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
          <Group groupDetail={groupDetail} />
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
          pathname={`/analytics/pricing/${groupId}`}
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingGroupDetailIn, PricingGroupDetailOut };
