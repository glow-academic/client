/**
 * app/(main)/intelligence/agents/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Agent from "@/components/artifacts/agent/Agent";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/api/v5/artifacts/agents/get", "post">;
type GetAgentOut = OutputOf<"/api/v5/artifacts/agents/get", "post">;
type CreateAgentIn = InputOf<"/api/v5/artifacts/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v5/artifacts/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v5/artifacts/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v5/artifacts/agents/update", "post">;
// Prompts delete removed - no prompts delete functionality needed
type PatchAgentDraftIn = InputOf<"/api/v5/artifacts/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v5/artifacts/agents/draft", "patch">;
type CreateDraftVoicesIn = InputOf<"/api/v5/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v5/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v5/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v5/resources/prompts", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgent = async (input: GetAgentIn): Promise<GetAgentOut> => {
  return api.post("/artifacts/agents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/agents/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/agents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/agents/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  const { agentId } = await params;
  const docs = await getDocs({ body: { entity_id: agentId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  return api.post("/artifacts/agents/create", input);
}

async function updateAgent(input: UpdateAgentIn): Promise<UpdateAgentOut> {
  "use server";
  return api.post("/artifacts/agents/update", input);
}

async function patchAgentDraft(
  input: PatchAgentDraftIn
): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/agents/draft", input);
}

async function createDraftVoices(
  input: CreateDraftVoicesIn
): Promise<CreateDraftVoicesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/voices", input);
}

async function createDraftPrompts(
  input: CreateDraftPromptsIn
): Promise<CreateDraftPromptsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/prompts", input);
}
/** ---- Server renders client with typed data and actions ---- */
export default async function AgentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { agentId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Fetch agent detail (always fresh - source of truth) with draft_id
  try {
    const input: GetAgentIn = {
      body: {
        agent_id: agentId,
        draft_id: q.draftId ?? null,
      } as GetAgentIn["body"],
    };
    const [agentDetail, docs, draftsResult] = await Promise.all([
      agentId ? getAgent(input) : Promise.resolve(null),
      getDocs({ body: { entity_id: agentId } }),
      api.post("/artifacts/agents/drafts", {})
    ]);

    const entityName = docs.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Agents", section: "agents", url: "/intelligence/agents" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
        />
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
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="agent"
          redirectPath="/intelligence/agents"
        />
      );
    }
    // Re-throw other errors
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
