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

/** ---- Strong types from OpenAPI ---- */
type AgentNewOut = OutputOf<"/api/v3/agents/new", "post">;
type CreateAgentIn = InputOf<"/api/v3/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v3/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v3/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v3/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v3/prompts/delete", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v3/prompts/delete", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgentDefault = async (): Promise<AgentNewOut> => {
  return api.post(
    "/agents/new",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
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
  return api.post("/agents/delete-prompt", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Agent",
    description:
      "Create a new AI agent for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
  };
}

export default async function NewAgentPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch default agent detail server-side (per-profile cache)
  const agentDetailDefault = await getAgentDefault();

  return (
    <div
      className="space-y-6"
      data-page="agent-new"
      aria-label="Create new agent page"
    >
      <Agent
        agentDetailDefault={agentDetailDefault}
        createAgentAction={createAgent}
        updateAgentAction={updateAgent}
        deleteAgentPromptAction={deleteAgentPrompt}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentNewOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
