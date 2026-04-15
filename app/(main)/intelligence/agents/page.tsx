/**
 * app/(main)/intelligence/agents/page.tsx
 * Agent list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Agents from "@/components/artifacts/agent/Agents";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadAgentsSearchParams } from "@/lib/search-params/agents";

/** ---- Strong types from OpenAPI ---- */
type AgentsListOut = OutputOf<"/agent/search", "post">;
type DuplicateAgentIn = InputOf<"/agent/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/agent/duplicate", "post">;
type DeleteAgentIn = InputOf<"/agent/delete", "post">;
type DeleteAgentOut = OutputOf<"/agent/delete", "post">;
type GroupAgentIn = InputOf<"/agent/group", "post">;
type GroupAgentOut = OutputOf<"/agent/group", "post">;
type GenerateAgentIn = InputOf<"/agent/generate", "post">;
type GenerateAgentOut = OutputOf<"/agent/generate", "post">;
type GenerationsIn = InputOf<"/agent/generations", "post">;
type GenerationsOut = OutputOf<"/agent/generations", "post">;
type ProblemAgentIn = InputOf<"/agent/problem", "post">;
type ProblemAgentOut = OutputOf<"/agent/problem", "post">;
type ContextIn = InputOf<"/agent/context", "post">;
type ContextOut = OutputOf<"/agent/context", "post">;

/** ---- Body type for agents list request ---- */
type AgentsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_model_ids?: string[] | null;
  filter_tool_ids?: string[] | null;
  department_search?: string | null;
  model_search?: string | null;
  tool_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getAgentsList = async (body: AgentsListBody): Promise<AgentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/agent/search",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: { "X-Bypass-Cache": "1" },
      }),
    },
  );
};

/** ---- Strongly-typed server actions ---- */
async function duplicateAgent(
  input: DuplicateAgentIn,
): Promise<DuplicateAgentOut> {
  "use server";
  return api.post("/agent/duplicate", input);
}

async function deleteAgent(input: DeleteAgentIn): Promise<DeleteAgentOut> {
  "use server";
  return api.post("/agent/delete", input);
}

async function generateAgent(
  input: GenerateAgentIn
): Promise<GenerateAgentOut> {
  "use server";
  return api.post("/agent/generate", input);
}

async function getAgentGroupHistory(groupId: string): Promise<GroupAgentOut> {
  "use server";
  return api.post("/agent/group", { body: { group_id: groupId } } as GroupAgentIn);
}

async function searchAgentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/agent/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createAgentProblem(input: ProblemAgentIn): Promise<ProblemAgentOut> {
  "use server";
  return api.post("/agent/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/agent/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface AgentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/agent/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  const q = loadAgentsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: AgentsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_model_ids: q.modelIds && q.modelIds.length > 0 ? q.modelIds : null,
    filter_tool_ids: q.toolIds && q.toolIds.length > 0 ? q.toolIds : null,
    department_search: q.departmentSearch || null,
    model_search: q.modelSearch || null,
    tool_search: q.toolSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getAgentsList(body),
    api.post("/agent/group", { body: {} } as GroupAgentIn),
  ]);

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "agent",
        createFeedback: createAgentProblem,
      }}
      breadcrumbs={[
        { title: "Intelligence", section: "intelligence", url: "/intelligence" },
        { title: "Agents" },
      ]}
      toolbar={<NewArtifactButton label="New Agent" href="/intelligence/agents/new" />}
      panelProps={{
        artifactType: "agent",
        groupId: (groupResult as GroupAgentOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateAgent,
        permissions: [
          { artifact: "agent", operation: "draft" },
          { artifact: "agent", operation: "get" },
          { artifact: "agent", operation: "docs" },
          { artifact: "agent", operation: "group" },
        ],
        getGroupHistory: getAgentGroupHistory,
        searchGroups: searchAgentGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="agents-index">
        <Agents
          listData={listData}
          duplicateAgentAction={duplicateAgent}
          deleteAgentAction={deleteAgent}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          departmentSearch={q.departmentSearch ?? ""}
          modelSearch={q.modelSearch ?? ""}
          toolSearch={q.toolSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
};
