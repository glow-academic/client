/**
 * app/(main)/intelligence/tools/page.tsx
 * Tools list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Tools from "@/components/artifacts/tool/Tools";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadToolsSearchParams } from "@/lib/search-params/tools";

/** ---- Strong types from OpenAPI ---- */
type ToolsListIn = InputOf<"/tool/search", "post">;
type ToolsListOut = OutputOf<"/tool/search", "post">;
type DeleteToolIn = InputOf<"/tool/delete", "post">;
type DeleteToolOut = OutputOf<"/tool/delete", "post">;
type DuplicateToolIn = InputOf<"/tool/duplicate", "post">;
type DuplicateToolOut = OutputOf<"/tool/duplicate", "post">;
type GroupToolIn = InputOf<"/tool/group", "post">;
type GroupToolOut = OutputOf<"/tool/group", "post">;
type GenerateToolIn = InputOf<"/tool/generate", "post">;
type GenerateToolOut = OutputOf<"/tool/generate", "post">;
type GenerationsIn = InputOf<"/tool/generations", "post">;
type GenerationsOut = OutputOf<"/tool/generations", "post">;
type ProblemToolIn = InputOf<"/tool/problem", "post">;
type ProblemToolOut = OutputOf<"/tool/problem", "post">;
type ContextIn = InputOf<"/tool/context", "post">;
type ContextOut = OutputOf<"/tool/context", "post">;

/** ---- Body type for tools list request ---- */
type ToolsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_agent_ids?: string[] | null;
  filter_creatable?: string[] | null;
  department_search?: string | null;
  agent_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getToolsList = async (body: ToolsListBody): Promise<ToolsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/tool/search",
    { body } as ToolsListIn,
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteTool(input: DeleteToolIn): Promise<DeleteToolOut> {
  "use server";
  return api.post("/tool/delete", input);
}

async function duplicateTool(
  input: DuplicateToolIn
): Promise<DuplicateToolOut> {
  "use server";
  return api.post("/tool/duplicate", input);
}

async function generateTool(
  input: GenerateToolIn
): Promise<GenerateToolOut> {
  "use server";
  return api.post("/tool/generate", input);
}

async function getToolGroupHistory(groupId: string): Promise<GroupToolOut> {
  "use server";
  return api.post("/tool/group", { body: { group_id: groupId } } as GroupToolIn);
}

async function searchToolGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/tool/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createToolProblem(input: ProblemToolIn): Promise<ProblemToolOut> {
  "use server";
  return api.post("/tool/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/tool/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ToolsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/tool/context", { body: {} } as ContextIn) as ContextOut;
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

  const q = loadToolsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ToolsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_agent_ids: q.agentIds && q.agentIds.length > 0 ? q.agentIds : null,
    filter_creatable: q.creatableIds && q.creatableIds.length > 0 ? q.creatableIds : null,
    department_search: q.departmentSearch || null,
    agent_search: q.agentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data, and group in parallel
  const [listData, groupResult] = await Promise.all([
    getToolsList(body),
    api.post("/tool/group", { body: {} } as GroupToolIn),
  ]);

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "tool",
        createFeedback: createToolProblem,
      }}
      breadcrumbs={[
        { title: "Intelligence", section: "intelligence", url: "/intelligence" },
        { title: "Tools" },
      ]}
      toolbar={<NewArtifactButton label="New Tool" href="/intelligence/tools/new" />}
      panelProps={{
        artifactType: "tool",
        groupId: (groupResult as GroupToolOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateTool,
        operations: ["draft", "get", "group"],
        getGroupHistory: getToolGroupHistory,
        searchGroups: searchToolGroups,
        prompts: context.prompts?.prompts,
      }}
    >
      <div className="space-y-6 px-4" data-page="tools-index">
        <Tools
          listData={listData}
          deleteToolAction={deleteTool}
          duplicateToolAction={duplicateTool}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          departmentSearch={q.departmentSearch ?? ""}
          agentSearch={q.agentSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
};
