/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Parameters from "@/components/artifacts/parameter/Parameters";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type ParametersListOut = OutputOf<"/parameters/search", "post">;
type DuplicateParameterIn = InputOf<"/parameters/duplicate", "post">;
type DuplicateParameterOut = OutputOf<"/parameters/duplicate", "post">;
type DeleteParameterIn = InputOf<"/parameters/delete", "post">;
type DeleteParameterOut = OutputOf<"/parameters/delete", "post">;
type GroupParameterIn = InputOf<"/parameters/group", "post">;
type GroupParameterOut = OutputOf<"/parameters/group", "post">;
type GenerateParameterIn = InputOf<"/parameters/generate", "post">;
type GenerateParameterOut = OutputOf<"/parameters/generate", "post">;
type GenerationsIn = InputOf<"/parameters/generations", "post">;
type GenerationsOut = OutputOf<"/parameters/generations", "post">;
type ProblemParameterIn = InputOf<"/parameters/problem", "post">;
type ProblemParameterOut = OutputOf<"/parameters/problem", "post">;
type ContextIn = InputOf<"/parameters/context", "post">;
type ContextOut = OutputOf<"/parameters/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getParametersList = async (): Promise<ParametersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/parameters/search",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateParameter(
  input: DuplicateParameterIn,
): Promise<DuplicateParameterOut> {
  "use server";
  return api.post("/parameters/duplicate", input);
}

async function deleteParameter(
  input: DeleteParameterIn,
): Promise<DeleteParameterOut> {
  "use server";
  return api.post("/parameters/delete", input);
}

async function generateParameter(
  input: GenerateParameterIn
): Promise<GenerateParameterOut> {
  "use server";
  return api.post("/parameters/generate", input);
}

async function getParameterGroupHistory(groupId: string): Promise<GroupParameterOut> {
  "use server";
  return api.post("/parameters/group", { body: { group_id: groupId } } as GroupParameterIn);
}

async function searchParameterGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/parameters/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createParameterProblem(input: ProblemParameterIn): Promise<ProblemParameterOut> {
  "use server";
  return api.post("/parameters/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/parameters/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function ContextPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getParametersList(),
    api.post("/parameters/group", { body: {} } as GroupParameterIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "parameter",
        createFeedback: createParameterProblem,
      }}
      breadcrumbs={[
        { title: "Management", section: "management", url: "/management" },
        { title: "Parameters" },
      ]}
      toolbar={<NewArtifactButton label="New Parameter" href="/management/parameters/new" />}
      panelProps={{
        artifactType: "parameter",
        groupId: (groupResult as GroupParameterOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateParameter,
        permissions: [
          { artifact: "parameter", operation: "draft" },
          { artifact: "parameter", operation: "get" },
          { artifact: "parameter", operation: "docs" },
          { artifact: "parameter", operation: "group" },
        ],
        getGroupHistory: getParameterGroupHistory,
        searchGroups: searchParameterGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="parameters-index">
        <Parameters
          listData={listData}
          duplicateParameterAction={duplicateParameter}
          deleteParameterAction={deleteParameter}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListOut,
};
