/**
 * app/(main)/intelligence/tools/page.tsx
 * Tools list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Tools from "@/components/artifacts/tool/Tools";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadToolsSearchParams } from "@/lib/search-params/tools";
import { readViewCookie } from "@/lib/view-cookie";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type ToolsListIn = InputOf<"/tool/search", "post">;
type ToolsListOut = OutputOf<"/tool/search", "post">;
type DeleteToolIn = InputOf<"/tool/delete", "post">;
type DeleteToolOut = OutputOf<"/tool/delete", "post">;
type DuplicateToolIn = InputOf<"/tool/duplicate", "post">;
type DuplicateToolOut = OutputOf<"/tool/duplicate", "post">;
type UpdateToolIn = InputOf<"/tool/update", "post">;
type UpdateToolOut = OutputOf<"/tool/update", "post">;
type GroupToolIn = InputOf<"/tool/group", "post">;
type GroupToolOut = OutputOf<"/tool/group", "post">;
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

async function updateTool(input: UpdateToolIn): Promise<UpdateToolOut> {
  "use server";
  return api.post("/tool/update", input);
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

/** ---- GenerationPanel server actions ---- */
async function getToolGroup(input: GroupToolIn): Promise<GroupToolOut> {
  "use server";
  return api.post("/tool/group", input);
}

async function searchToolGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/tool/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getToolContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/tool/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getToolContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Tools" };
  }
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

  try {
    // Profile data for providers
    const context = await getToolContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/intelligence/tools", context.profile.role_permissions);

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

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getToolsList(body),
      readViewCookie("tools"),
      api.post(
        "/tool/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupToolIn,
      ),
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
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupToolOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupToolOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getToolGroupHistory,
          searchGroups: searchToolGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getToolGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchToolGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="tools-index">
          <Tools
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            deleteToolAction={deleteTool}
            duplicateToolAction={duplicateTool}
            updateToolAction={updateTool}
            currentSearchBody={body}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalCount={listData.total_count ?? 0}
            departmentSearch={q.departmentSearch ?? ""}
            agentSearch={q.agentSearch ?? ""}
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
          pathname="/intelligence/tools"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
  ToolsListBody,
  UpdateToolIn,
  UpdateToolOut,
};
