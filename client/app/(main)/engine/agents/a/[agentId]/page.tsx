/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import SystemAgent from "@/components/agents/SystemAgent";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgent = async (
  agentId: string,
  profileId: string
): Promise<AgentDetailOut> => {
  return api.post(
    "/agents/detail",
    { body: { agentId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { agentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const agent = await getAgent(agentId, profileId);
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
async function createAgent(
  input: CreateAgentIn,
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
  input: UpdateAgentIn,
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
  input: DeleteAgentPromptIn,
): Promise<DeleteAgentPromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/delete-prompt", input);
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

  // Fetch agent detail (always fresh - source of truth)
  try {
    const agentDetail = agentId
      ? await getAgent(agentId, profileId)
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
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <DepartmentAccessDenied
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
  AgentDetailDefaultIn,
  AgentDetailDefaultOut,
  AgentDetailOut,
  CreateAgentIn,
  CreateAgentOut,
  DeleteAgentPromptIn,
  DeleteAgentPromptOut,
  UpdateAgentIn,
  UpdateAgentOut,
};
