/**
 * app/(main)/intelligence/agents/new/page.tsx
 * New agent page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Agent from "@/components/artifacts/agent/Agent";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/agents/get", "post">;
type GetAgentOut = OutputOf<"/agents/get", "post">;
type CreateAgentIn = InputOf<"/agents/create", "post">;
type CreateAgentOut = OutputOf<"/agents/create", "post">;
type PatchAgentDraftIn = InputOf<"/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/agents/draft", "patch">;
type CreateDraftVoicesIn = InputOf<"/api/v5/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v5/resources/voices", "post">;
type GroupAgentIn = InputOf<"/agents/group", "post">;
type GroupAgentOut = OutputOf<"/agents/group", "post">;
type GenerateAgentIn = InputOf<"/agents/generate", "post">;
type GenerateAgentOut = OutputOf<"/agents/generate", "post">;
type GenerationsIn = InputOf<"/agents/generations", "post">;
type GenerationsOut = OutputOf<"/agents/generations", "post">;
type ProblemAgentIn = InputOf<"/agents/problem", "post">;
type ProblemAgentOut = OutputOf<"/agents/problem", "post">;
type ContextIn = InputOf<"/agents/context", "post">;
type ContextOut = OutputOf<"/agents/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getAgent = async (input: GetAgentIn): Promise<GetAgentOut> => {
  return api.post("/agents/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  return api.post("/agents/create", input);
}

async function patchAgentDraft(input: PatchAgentDraftIn): Promise<PatchAgentDraftOut> {
  "use server";
  return api.patch("/agents/draft", input);
}

async function createDraftVoices(input: CreateDraftVoicesIn): Promise<CreateDraftVoicesOut> {
  "use server";
  return api.post("/resources/voices", input);
}

async function generateAgent(
  input: GenerateAgentIn
): Promise<GenerateAgentOut> {
  "use server";
  return api.post("/agents/generate", input);
}

async function getAgentGroupHistory(groupId: string): Promise<GroupAgentOut> {
  "use server";
  return api.post("/agents/group", { body: { group_id: groupId } } as GroupAgentIn);
}

async function searchAgentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/agents/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createAgentProblem(input: ProblemAgentIn): Promise<ProblemAgentOut> {
  "use server";
  return api.post("/agents/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/agents/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/agents/context", { body: {} } as ContextIn) as ContextOut;
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

  // Inline server-side parsers for agent search params
  const agentSearchParams = {
    draftId: parseAsString,
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  // SSR data fetches
  const input: GetAgentIn = {
    body: {
      agent_id: null,
      draft_id: q.draftId ?? null,
    } as GetAgentIn["body"],
  };

  const [agentDetailDefault, draftsResult, groupResult] = await Promise.all([
    getAgent(input),
    api.post("/agents/drafts", {}),
    api.post("/agents/group", { body: {} } as GroupAgentIn),
  ]);

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
          { title: "New Agent" },
        ]}
        toolbar={<SaveToolbar />}
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
        <div
          className="space-y-6 px-4"
          data-page="agent-new"
          aria-label="Create new agent page"
        >
          <Agent
            key={q.draftId || "no-draft"}
            agentDetailDefault={agentDetailDefault}
            createAgentAction={createAgent}
            patchAgentDraftAction={patchAgentDraft}
            createVoicesAction={createDraftVoices}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { GetAgentIn, GetAgentOut, CreateAgentIn, CreateAgentOut };
