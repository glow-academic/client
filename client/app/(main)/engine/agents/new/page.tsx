/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SystemAgent from "@/components/agents/SystemAgent";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AgentDetailDefaultOut = OutputOf<"/api/v3/agents/detail-default", "post">;
type CreateAgentIn = InputOf<"/api/v3/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v3/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v3/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v3/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v3/agents/delete-prompt", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v3/agents/delete-prompt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgentDefault = async (
  profileId: string
): Promise<AgentDetailDefaultOut> => {
  return api.post(
    "/agents/detail-default",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAgent(
  input: CreateAgentIn
): Promise<CreateAgentOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function updateAgent(
  input: UpdateAgentIn
): Promise<UpdateAgentOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function deleteAgentPrompt(
  input: DeleteAgentPromptIn
): Promise<DeleteAgentPromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/delete-prompt", input);
}

export const metadata: Metadata = {
  title: "New Agent",
  description: `Create new AI agents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewAgentPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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
  AgentDetailDefaultOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
