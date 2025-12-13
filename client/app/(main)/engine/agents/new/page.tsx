/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SystemAgent from "@/components/agents/SystemAgent";
import { AccessDenied } from "@/components/common/layout/AccessDenied";
import { api } from "@/lib/api/client";
import { requireAuthenticated } from "@/lib/auth-helpers";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AgentNewOut = OutputOf<"/api/v3/agents/new", "post">;
type CreateAgentIn = InputOf<"/api/v3/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v3/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v3/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v3/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v3/agents/delete-prompt", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v3/agents/delete-prompt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgentDefault = async (profileId: string): Promise<AgentNewOut> => {
  return api.post(
    "/agents/new",
    { body: { profileId } },
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
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

async function updateAgent(input: UpdateAgentIn): Promise<UpdateAgentOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/update", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
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
  const authResult = await requireAuthenticated().catch(() => null);
  if (!authResult) {
    return <AccessDenied redirectPath="/engine/agents" />;
  }

  const profileId = authResult.effectiveProfileId;

  // Fetch default agent detail server-side (per-profile cache)
  const agentDetailDefault = await getAgentDefault(profileId);

  return (
    <div
      className="space-y-6"
      data-page="agent-new"
      aria-label="Create new agent page"
    >
      <SystemAgent
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
