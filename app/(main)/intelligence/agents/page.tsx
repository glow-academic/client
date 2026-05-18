/**
 * app/(main)/intelligence/agents/page.tsx
 * Agent list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import Agents from "@/components/artifacts/agent/Agents";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadAgentsSearchParams } from "@/lib/search-params/agents";
import { readViewCookie } from "@/lib/view-cookie";
import type { ParseCsvResult } from "@/components/common/BulkImport";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type AgentsListOut = OutputOf<"/agent/search", "post">;
type DuplicateAgentIn = InputOf<"/agent/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/agent/duplicate", "post">;
type DeleteAgentIn = InputOf<"/agent/delete", "post">;
type DeleteAgentOut = OutputOf<"/agent/delete", "post">;
type UpdateAgentIn = InputOf<"/agent/update", "post">;
type UpdateAgentOut = OutputOf<"/agent/update", "post">;
type CreateAgentIn = InputOf<"/agent/create", "post">;
type CreateAgentOut = OutputOf<"/agent/create", "post">;
type GroupAgentIn = InputOf<"/agent/group", "post">;
type GroupAgentOut = OutputOf<"/agent/group", "post">;
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

async function updateAgent(input: UpdateAgentIn): Promise<UpdateAgentOut> {
  "use server";
  return api.post("/agent/update", input);
}

async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  return api.post("/agent/create", input);
}

async function exportAgents(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/agent/export", {
    body: {},
  } as unknown as InputOf<"/agent/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshAgents(): Promise<unknown> {
  "use server";
  return api.post("/agent/refresh", {
    body: {},
  } as unknown as InputOf<"/agent/refresh", "post">);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/agent/csv", { formData });
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

/** ---- GenerationPanel server actions ---- */
async function getAgentGroup(input: GroupAgentIn): Promise<GroupAgentOut> {
  "use server";
  return api.post("/agent/group", input);
}

async function searchAgentGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/agent/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAgentContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/agent/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getAgentContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Agents" };
  }
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

  try {
    // Profile data for providers
    const context = await getAgentContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/intelligence/agents", context.profile.role_permissions);

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

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getAgentsList(body),
      readViewCookie("agents"),
      api.post(
        "/agent/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupAgentIn,
      ),
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
        toolbar={
          <ArtifactToolbarActions
            newButton={{ label: "New Agent", href: "/intelligence/agents/new" }}
            exportAction={exportAgents}
            refreshAction={refreshAgents}
            bffDownloadPrefix="/api/agent/download"
          />
        }
        panelProps={{
          artifactType: "agent",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupAgentOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupAgentOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getAgentGroupHistory,
          searchGroups: searchAgentGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getAgentGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchAgentGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="agents-index">
          <Agents
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateAgentAction={duplicateAgent}
            deleteAgentAction={deleteAgent}
            updateAgentAction={updateAgent}
            createAgentAction={createAgent}
            parseCsvAction={parseCsv}
            importFields={listData.import_fields ?? undefined}
            currentSearchBody={body}
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
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname="/intelligence/agents"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="agent"
            redirectPath="/intelligence/agents"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentsListOut,
  AgentsListBody,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
  CreateAgentIn,
  CreateAgentOut,
};
