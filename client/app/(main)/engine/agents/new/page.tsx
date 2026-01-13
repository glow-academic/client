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
type GetAgentIn = InputOf<"/api/v4/agents/get", "post">;
type GetAgentOut = OutputOf<"/api/v4/agents/get", "post">;
type SaveAgentIn = InputOf<"/api/v4/agents/save", "post">;
type SaveAgentOut = OutputOf<"/api/v4/agents/save", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v4/prompts/delete", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v4/prompts/delete", "post">;
type PatchAgentDraftIn = InputOf<"/api/v4/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v4/agents/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgent = async (
  input: GetAgentIn
): Promise<GetAgentOut> => {
  return api.post("/agents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveAgent(input: SaveAgentIn): Promise<SaveAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/save", input);
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

  // Fetch default agent detail server-side with draft_id (agent_id = null for new mode)
  const input: GetAgentIn = {
    body: {
      agent_id: null,
      draft_id: q.draftId ?? null,
    } as GetAgentIn["body"],
  };
  const agentDetailDefault = await getAgent(input);

  return (
    <div
      className="space-y-6"
      data-page="agent-new"
      aria-label="Create new agent page"
    >
      <Agent
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        agentDetailDefault={agentDetailDefault}
        saveAgentAction={saveAgent}
        deleteAgentPromptAction={deleteAgentPrompt}
        patchAgentDraftAction={patchAgentDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetAgentIn,
  GetAgentOut,
  SaveAgentIn,
  SaveAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
};
