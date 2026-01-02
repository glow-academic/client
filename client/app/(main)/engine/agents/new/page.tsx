/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Agent from "@/components/agents/Agent";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type AgentNewIn = InputOf<"/api/v4/agents/new", "post">;
type AgentNewOut = OutputOf<"/api/v4/agents/new", "post">;
type CreateAgentIn = InputOf<"/api/v4/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v4/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v4/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v4/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v4/prompts/delete", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v4/prompts/delete", "post">;
type PatchAgentDraftIn = InputOf<"/api/v4/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v4/agents/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgentDefault = async (
  input: AgentNewIn
): Promise<AgentNewOut> => {
  return api.post("/agents/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/create", input);
}

async function updateAgent(input: UpdateAgentIn): Promise<UpdateAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/update", input);
}

async function deleteAgentPrompt(
  input: DeleteAgentPromptIn,
): Promise<DeleteAgentPromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/prompts/delete", input);
}

async function patchAgentDraft(
  input: PatchAgentDraftIn
): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/agents/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Agent",
    description:
      "Create a new AI agent for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
  };
}

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Fetch default agent detail server-side with draft_id
  const input: AgentNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as AgentNewIn["body"],
  };
  const agentDetailDefault = await getAgentDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="agent-new"
      aria-label="Create new agent page"
    >
      <Agent
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        agentDetailDefault={agentDetailDefault}
        createAgentAction={createAgent}
        updateAgentAction={updateAgent}
        deleteAgentPromptAction={deleteAgentPrompt}
        patchAgentDraftAction={patchAgentDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentNewIn,
  AgentNewOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
