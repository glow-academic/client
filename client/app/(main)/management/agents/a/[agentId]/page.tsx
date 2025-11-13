/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SystemAgent from "@/components/agents/SystemAgent";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type AgentDetailOut = OutputOf<"/api/v3/agents/detail", "post">;
type AgentDetailDefaultIn = InputOf<
  "/api/v3/agents/detail-default",
  "post"
>;
type AgentDetailDefaultOut = OutputOf<
  "/api/v3/agents/detail-default",
  "post"
>;
type CreateAgentIn = InputOf<"/api/v3/agents/create", "post">;
type CreateAgentOut = OutputOf<"/api/v3/agents/create", "post">;
type UpdateAgentIn = InputOf<"/api/v3/agents/update", "post">;
type UpdateAgentOut = OutputOf<"/api/v3/agents/update", "post">;
type DeleteAgentPromptIn = InputOf<"/api/v3/agents/delete-prompt", "post">;
type DeleteAgentPromptOut = OutputOf<
  "/api/v3/agents/delete-prompt",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getAgent = (agentId: string) =>
  unstable_cache(
    async (profileId: string): Promise<AgentDetailOut> => {
      return api.post("/agents/detail", {
        body: { agentId, profileId },
      });
    },
    ["agents:detail", agentId],
    { tags: ["agents", `agent:${agentId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { agentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const agent = await getAgent(agentId)(profileId);
    return {
      title: `${agent?.name || "Agent"} Agent`,
      description: `${agent ? `${agent.name} ${agent.description}` : "Agent"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Agent",
      description: `Agent in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createAgent(
  input: CreateAgentIn,
): Promise<CreateAgentOut> {
  "use server";
  const out = await api.post("/agents/create", input);
  revalidateTag("agents");
  return out;
}

export async function updateAgent(
  input: UpdateAgentIn,
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

export async function deleteAgentPrompt(
  input: DeleteAgentPromptIn,
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

/** ---- Server renders client with typed data and actions ---- */
export default async function AgentEditPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch agent detail (cached, won't duplicate with metadata)
  const agentDetail = agentId
    ? await getAgent(agentId)(profileId).catch(() => null)
    : null;

  return (
    <div
      className="space-y-6"
      data-page="agent-edit"
      data-agent-id={agentId}
    >
      <SystemAgent
        agentId={agentId}
        {...(agentDetail && { agentDetail })}
        createAgentAction={createAgent}
        updateAgentAction={updateAgent}
        deleteAgentPromptAction={deleteAgentPrompt}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentDetailDefaultIn,
  AgentDetailDefaultOut,
  AgentDetailIn,
  AgentDetailOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
