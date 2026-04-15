/**
 * app/(main)/analytics/pricing/[groupId]/page.tsx
 * Pricing group detail page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import Group from "@/components/artifacts/group/Group";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/group/get", "post">;
type PricingGroupDetailOut = OutputOf<"/group/get", "post">;
type ContextIn = InputOf<"/group/context", "post">;
type ContextOut = OutputOf<"/group/context", "post">;
type GenerateGroupIn = InputOf<"/group/generate", "post">;
type GenerateGroupOut = OutputOf<"/group/generate", "post">;
type GenerationsIn = InputOf<"/group/generations", "post">;
type GenerationsOut = OutputOf<"/group/generations", "post">;
type GroupGroupIn = InputOf<"/group/group", "post">;
type GroupGroupOut = OutputOf<"/group/group", "post">;
type ProblemGroupIn = InputOf<"/group/problem", "post">;
type ProblemGroupOut = OutputOf<"/group/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingGroupDetail = async (
  input: PricingGroupDetailIn
): Promise<PricingGroupDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/group/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function generateGroup(
  input: GenerateGroupIn
): Promise<GenerateGroupOut> {
  "use server";
  return api.post("/group/generate", input);
}

async function getGroupGroupHistory(groupId: string): Promise<GroupGroupOut> {
  "use server";
  return api.post("/group/group", { body: { group_id: groupId } } as GroupGroupIn);
}

async function searchGroupGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/group/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createGroupProblem(input: ProblemGroupIn): Promise<ProblemGroupOut> {
  "use server";
  return api.post("/group/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const context = await api.post("/group/context", { body: { entity_id: groupId } } as ContextIn) as ContextOut;
  return { title: context.page_metadata?.detail.title, description: context.page_metadata?.detail.description };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function PricingGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
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

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  const [groupDetail, context, genGroupResult] = await Promise.all([
    getPricingGroupDetail({
      body: {
        group_id: groupId,
      },
    }),
    api.post("/group/context", { body: { entity_id: groupId } } as ContextIn) as Promise<ContextOut>,
    api.post("/group/group", { body: {} } as GroupGroupIn),
  ]);

  const _entityName = context.page_metadata?.detail.title;

  return (
    <FullPageLayout
      profileData={profileData}
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
        groupId: (genGroupResult as GroupGroupOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateGroup,
        permissions: [
          { artifact: "group", operation: "draft" },
          { artifact: "group", operation: "get" },
          { artifact: "group", operation: "docs" },
          { artifact: "group", operation: "group" },
        ],
        getGroupHistory: getGroupGroupHistory,
        searchGroups: searchGroupGroups,
      }}
    >
      <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <Group groupDetail={groupDetail} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingGroupDetailIn, PricingGroupDetailOut };
