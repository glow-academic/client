/**
 * app/(main)/intelligence/agents/new/page.tsx
 * New agent page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Agent from "@/components/artifacts/agent/Agent";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

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
type PatchAgentDraftIn = InputOf<"/agent/draft", "post">;
type PatchAgentDraftOut = OutputOf<"/agent/draft", "post">;
type GroupAgentIn = InputOf<"/agent/group", "post">;
type GroupAgentOut = OutputOf<"/agent/group", "post">;
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

async function patchAgentDraft(input: PatchAgentDraftIn): Promise<PatchAgentDraftOut> {
  "use server";
  return api.post("/agent/draft", input);
}

async function createAgentProblem(input: ProblemAgentIn): Promise<ProblemAgentOut> {
  "use server";
  return api.post("/agent/problem", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
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
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Agents" };
  }
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

  try {
    // Profile data for providers
    const context = await getAgentContext();
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
      modelSearch: parseAsString,
      toolSearch: parseAsString,
      toolShowSelected: parseAsString,
      modelShowSelected: parseAsString,
      reasoningSearch: parseAsString,
      voiceSearch: parseAsString,
      descriptionSearch: parseAsString,
      promptSearch: parseAsString,
      instructionsSearch: parseAsString,
    };
    const loadAgentSearchParams = createLoader(agentSearchParams);
    const q = loadAgentSearchParams(searchParamsObj);

    // SSR data fetches
    const input = {
      body: {
        id: null,
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

    const [agentDetailDefault, draftsResult, groupResult] = await Promise.all([
      getAgent(input),
      api.post("/agent/drafts", {} as any),
      api.post("/agent/group", { body: {} } as GroupAgentIn),
    ]);

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
            { title: "New Agent" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportAgents}
              refreshAction={refreshAgents}
              bffDownloadPrefix="/api/agent/download"
            />
          }
          panelProps={
            {
              artifactType: "agent",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId: (groupResult as GroupAgentOut & { group_id?: string })?.group_id ?? null,
              operations: ["draft", "get", "title"],
              ...(context.prompts?.prompts
                ? { prompts: context.prompts.prompts }
                : {}),
            } as any
          }
        >
          <div
            className="space-y-6 px-4"
            data-page="agent-new"
            aria-label="Create new agent page"
          >
            <Agent
              agentDetailDefault={agentDetailDefault}
              createAgentAction={createAgent}
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
            pathname="/intelligence/agents/new"
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
export type { GetAgentIn, GetAgentOut, CreateAgentIn, CreateAgentOut };
