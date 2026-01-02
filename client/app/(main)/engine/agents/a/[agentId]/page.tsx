/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Agent from "@/components/agents/Agent";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type AgentDetailIn = InputOf<"/api/v4/agents/detail", "post">;
type AgentDetailOut = OutputOf<"/api/v4/agents/detail", "post">;
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
const getAgent = async (
  input: AgentDetailIn
): Promise<AgentDetailOut> => {
  return api.post("/agents/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { agentId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: AgentDetailIn = {
      body: {
        agent_id: agentId,
      } as AgentDetailIn["body"],
    };
    const agent = await getAgent(input);
    return {
      title: `${agent?.name || "Agent"} Agent`,
      description: `${agent?.name ? `${agent.name} - ` : ""}AI agent configuration for teaching assistant training simulations.${agent?.description ? ` ${agent.description}` : ""} Customize intelligent agents to power student personas and enhance simulation-based learning experiences.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Agent",
    description:
      "AI agent configuration for teaching assistant training simulations. Customize intelligent agents to power student personas and enhance simulation-based learning experiences.",
  };
}

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
    const input: AgentDetailIn = {
      body: {
        agent_id: agentId,
        draft_id: q.draftId ?? null,
      } as AgentDetailIn["body"],
    };
    const agentDetail = agentId ? await getAgent(input) : null;

    return (
      <div className="space-y-6" data-page="agent-edit" data-agent-id={agentId}>
        <Agent
          agentId={agentId}
          {...(agentDetail && { agentDetail })}
          createAgentAction={createAgent}
          updateAgentAction={updateAgent}
          deleteAgentPromptAction={deleteAgentPrompt}
          patchAgentDraftAction={patchAgentDraft}
        />
      </div>
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
          redirectPath="/engine/agents"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentDetailIn,
  AgentDetailOut,
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
