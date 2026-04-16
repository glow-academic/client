/**
 * app/(main)/intelligence/agents/[agentId]/page.tsx
 * Agent edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Agent from "@/components/artifacts/agent/Agent";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/agent/get", "post">;
type GetAgentOut = OutputOf<"/agent/get", "post">;
type CreateAgentIn = InputOf<"/agent/create", "post">;
type CreateAgentOut = OutputOf<"/agent/create", "post">;
type UpdateAgentIn = InputOf<"/agent/update", "post">;
type UpdateAgentOut = OutputOf<"/agent/update", "post">;
type PatchAgentDraftIn = InputOf<"/agent/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/agent/draft", "patch">;
type CreateDraftVoicesIn = InputOf<"/api/v5/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v5/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v5/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v5/resources/prompts", "post">;
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

/** ---- Direct fetch (no caching - source of truth) ---- */
const getAgent = async (input: GetAgentIn): Promise<GetAgentOut> => {
  return api.post("/agent/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  return api.post("/agent/create", input);
}

async function updateAgent(input: UpdateAgentIn): Promise<UpdateAgentOut> {
  "use server";
  return api.post("/agent/update", input);
}

async function patchAgentDraft(
  input: PatchAgentDraftIn
): Promise<PatchAgentDraftOut> {
  "use server";
  return api.patch("/agent/draft", input);
}

async function createDraftVoices(
  input: CreateDraftVoicesIn
): Promise<CreateDraftVoicesOut> {
  "use server";
  return api.post("/resources/voices", input);
}

async function createDraftPrompts(
  input: CreateDraftPromptsIn
): Promise<CreateDraftPromptsOut> {
  "use server";
  return api.post("/resources/prompts", input);
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  try {
    const { agentId } = await params;
    const context = await api.post("/agent/context", { body: { entity_id: agentId } } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Agents" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function AgentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { agentId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for agent search params
  const agentSearchParams = {
    draftId: parseAsString,
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  try {
    const input: GetAgentIn = {
      body: {
        agent_id: agentId,
        draft_id: q.draftId ?? null,
      } as GetAgentIn["body"],
    };

    const [agentDetail, context, draftsResult, groupResult] = await Promise.all([
      getAgent(input),
      api.post("/agent/context", { body: { entity_id: agentId } } as ContextIn) as Promise<ContextOut>,
      api.post("/agent/drafts", {}),
      api.post("/agent/group", { body: {} } as GroupAgentIn),
    ]);

    const snapshot = buildSnapshot(session, context.profile);
    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Agents", section: "agents", url: "/intelligence/agents" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "agent",
            groupId: (groupResult as GroupAgentOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateAgent,
            operations: ["draft", "get", "group"],
            getGroupHistory: getAgentGroupHistory,
            searchGroups: searchAgentGroups,
            prompts: context.prompts?.prompts,
          }}
        >
          <div className="space-y-6 px-4" data-page="agent-edit" data-agent-id={agentId}>
            <Agent
              agentId={agentId}
              {...(agentDetail && { agentDetail })}
              createAgentAction={createAgent}
              updateAgentAction={updateAgent}
              patchAgentDraftAction={patchAgentDraft}
              createVoicesAction={createDraftVoices}
              createPromptsAction={createDraftPrompts}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
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
          reason="department"
          resourceType="agent"
          redirectPath="/intelligence/agents"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetAgentIn,
  GetAgentOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  CreateAgentIn,
  CreateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
