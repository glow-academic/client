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
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type AgentDetailDefaultOut = OutputOf<"/api/v3/agents/detail-default", "post">;
type CreateAgentIn = InputOf<"/api/v3/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v3/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v3/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v3/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v3/agents/delete-prompt", "post">;
type DeleteAgentPromptOut = OutputOf<"/api/v3/agents/delete-prompt", "post">;

/** ---- Cached fetch with Next tags ----
 * Per-profile cache entry tagged as 'agents' so create() can invalidate.
 */
const getAgentDefault = unstable_cache(
  async (profileId: string): Promise<AgentDetailDefaultOut> => {
    return api.post("/agents/detail-default", { body: { profileId } });
  },
  ["agents:detail-default"],
  { tags: ["agents"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAgent(
  input: CreateAgentIn
): Promise<CreateAgentOut> {
  "use server";
  const out = await api.post("/agents/create", input);
  revalidateTag("agents");
  return out;
}

async function updateAgent(
  input: UpdateAgentIn
): Promise<UpdateAgentOut> {
  "use server";
  const out = await api.post("/agents/update", input);
  revalidateTag("agents");
  const agentId = input.body?.agentId;
  if (agentId) {
    revalidateTag(`agent:${agentId}`);
  }
  return out;
}

async function deleteAgentPrompt(
  input: DeleteAgentPromptIn
): Promise<DeleteAgentPromptOut> {
  "use server";
  const out = await api.post("/agents/delete-prompt", input);
  revalidateTag("agents");
  const agentId = input.body?.agentId;
  if (agentId) {
    revalidateTag(`agent:${agentId}`);
  }
  return out;
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
