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
type GetAgentIn = InputOf<"/api/v4/agents/get", "post">;
type GetAgentOut = OutputOf<"/api/v4/agents/get", "post">;
type SaveAgentIn = InputOf<"/api/v4/agents/save", "post">;
type SaveAgentOut = OutputOf<"/api/v4/agents/save", "post">;
// Prompts delete removed - no prompts delete functionality needed
type PatchAgentDraftIn = InputOf<"/api/v4/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v4/agents/draft", "patch">;
type CreateDraftReasoningLevelsIn = InputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftReasoningLevelsOut = OutputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftTemperatureLevelsIn = InputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftTemperatureLevelsOut = OutputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgent = async (input: GetAgentIn): Promise<GetAgentOut> => {
  return api.post("/agents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetAgentIn = {
      body: {
        agent_id: agentId,
      } as GetAgentIn["body"],
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
async function saveAgent(input: SaveAgentIn): Promise<SaveAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/save", input);
}

// Prompts delete removed - no prompts delete functionality needed

async function patchAgentDraft(
  input: PatchAgentDraftIn
): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/agents/draft", input);
}

async function createDraftReasoningLevels(
  input: CreateDraftReasoningLevelsIn
): Promise<CreateDraftReasoningLevelsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/reasoning_levels", input);
}

async function createDraftTemperatureLevels(
  input: CreateDraftTemperatureLevelsIn
): Promise<CreateDraftTemperatureLevelsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/temperature_levels", input);
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
    descriptionSearch: parseAsString,
    promptSearch: parseAsString,
    instructionsSearch: parseAsString,
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  // Fetch agent detail (always fresh - source of truth) with draft_id
  try {
    const input: GetAgentIn = {
      body: {
        agent_id: agentId,
        draft_id: q.draftId ?? null,
        descriptions_search: q.descriptionSearch ?? null,
        prompts_search: q.promptSearch ?? null,
        instructions_search: q.instructionsSearch ?? null,
      } as GetAgentIn["body"],
    };
    const agentDetail = agentId ? await getAgent(input) : null;

    return (
      <div className="space-y-6" data-page="agent-edit" data-agent-id={agentId}>
        <Agent
          agentId={agentId}
          {...(agentDetail && { agentDetail })}
          saveAgentAction={saveAgent}
          patchAgentDraftAction={patchAgentDraft}
          createReasoningLevelsAction={createDraftReasoningLevels}
          createTemperatureLevelsAction={createDraftTemperatureLevels}
          createVoicesAction={createDraftVoices}
          createPromptsAction={createDraftPrompts}
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
  GetAgentIn,
  GetAgentOut,
  PatchAgentDraftIn,
  PatchAgentDraftOut,
  SaveAgentIn,
  SaveAgentOut,
};
