/**
 * app/(main)/intelligence/agents/[agentId]/page.tsx
 * Agent edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Agent from "@/components/artifacts/agent/Agent";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/agent/get", "post">;
type GetAgentOut = OutputOf<"/agent/get", "post">;
type CreateAgentIn = InputOf<"/agent/create", "post">;
type CreateAgentOut = OutputOf<"/agent/create", "post">;
type UpdateAgentIn = InputOf<"/agent/update", "post">;
type UpdateAgentOut = OutputOf<"/agent/update", "post">;
type PatchAgentDraftIn = InputOf<"/agent/draft", "post">;
type PatchAgentDraftOut = OutputOf<"/agent/draft", "post">;
type GroupAgentIn = InputOf<"/agent/group", "post">;
type GroupAgentOut = OutputOf<"/agent/group", "post">;
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
  return api.post("/agent/draft", input);
}


async function createAgentProblem(input: ProblemAgentIn): Promise<ProblemAgentOut> {
  "use server";
  return api.post("/agent/problem", input);
}

/** Per-item export — scopes to a single ``agent_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportAgentById(agentId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/agent/export", {
    body: { agent_id: agentId },
  } as unknown as InputOf<"/agent/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshAgent(): Promise<unknown> {
  "use server";
  return api.post("/agent/refresh", {
    body: {},
  } as unknown as InputOf<"/agent/refresh", "post">);
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
const getAgentContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/agent/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  try {
    const { agentId } = await params;
    const context = await getAgentContextById(agentId);
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
    modelSearch: parseAsString,
    toolSearch: parseAsString,
    toolShowSelected: parseAsString,
    modelShowSelected: parseAsString,
    reasoningSearch: parseAsString,
    voiceSearch: parseAsString,
    descriptionSearch: parseAsString,
    promptSearch: parseAsString,
    instructionsSearch: parseAsString,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  try {
    const input = {
      body: {
        id: agentId,
        draft_id: q.draftId ?? null,
        descriptions: q.descriptionSearch ? { search: q.descriptionSearch } : undefined,
        models:
          q.modelSearch || q.modelShowSelected
            ? {
                search: q.modelSearch ?? undefined,
                selected: q.modelShowSelected === "true" ? true : undefined,
              }
            : undefined,
        prompts: q.promptSearch ? { search: q.promptSearch } : undefined,
        instructions: q.instructionsSearch ? { search: q.instructionsSearch } : undefined,
        tools:
          q.toolSearch || q.toolShowSelected
            ? {
                search: q.toolSearch ?? undefined,
                selected: q.toolShowSelected === "true" ? true : undefined,
              }
            : undefined,
        reasoning_levels: q.reasoningSearch ? { search: q.reasoningSearch } : undefined,
        voices: q.voiceSearch ? { search: q.voiceSearch } : undefined,
      } as GetAgentIn["body"],
    } as unknown as GetAgentIn;

    const [agentDetail, context, draftsResult, groupResult] = await Promise.all([
      getAgent(input),
      getAgentContextById(agentId) as Promise<ContextOut>,
      api.post("/agent/drafts", { body: {} } as any),
      api.post(
        "/agent/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupAgentIn,
      ),
    ]);

    const snapshot = buildSnapshot(session, context.profile);
    const entityName = context.page_metadata?.detail.title ?? "Agent";

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          {...(initialSidebarOpen !== undefined ? { initialSidebarOpen } : {})}
          {...(initialPanelOpen !== undefined ? { initialPanelOpen } : {})}
          sidebarProps={{
            activeSection: "agent",
            createFeedback: createAgentProblem as any,
          }}
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Agents", section: "agents", url: "/intelligence/agents" },
            { title: entityName },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportAgentById.bind(null, agentId)}
              refreshAction={refreshAgent}
              bffDownloadPrefix="/api/agent/download"
            />
          }
          panelProps={
            {
              artifactType: "agent",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId: (groupResult as GroupAgentOut & { group_id?: string })?.group_id ?? null,
              groupName:
                (groupResult as GroupAgentOut & { name?: string | null })?.name ?? null,
              operations: ["draft", "get", "title"],
              ...(context.prompts?.prompts
                ? { prompts: context.prompts.prompts }
                : {}),
              getGroupAction: getAgentGroup as PanelProps["getGroupAction"],
              searchGenerationsAction:
                searchAgentGenerations as PanelProps["searchGenerationsAction"],
            } as any
          }
        >
          <div className="space-y-6 px-4" data-page="agent-edit" data-agent-id={agentId}>
            <Agent
              agentId={agentId}
              {...(agentDetail && { agentDetail })}
              createAgentAction={createAgent}
              updateAgentAction={updateAgent}
              patchAgentDraftAction={patchAgentDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
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
            pathname={`/intelligence/agents/${agentId}`}
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
  GetAgentIn,
  GetAgentOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  CreateAgentIn,
  CreateAgentOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
