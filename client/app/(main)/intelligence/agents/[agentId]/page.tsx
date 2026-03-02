/**
 * app/(main)/intelligence/agents/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Agent from "@/components/artifacts/agent/Agent";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/api/v4/artifacts/agents/get", "post">;
type GetAgentOut = OutputOf<"/api/v4/artifacts/agents/get", "post">;
type SaveAgentIn = InputOf<"/api/v4/artifacts/agents/save", "post">;
type SaveAgentOut = OutputOf<"/api/v4/artifacts/agents/save", "post">;
// Prompts delete removed - no prompts delete functionality needed
type PatchAgentDraftIn = InputOf<"/api/v4/artifacts/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v4/artifacts/agents/draft", "patch">;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftPromptsIn = InputOf<"/api/v4/resources/prompts", "post">;
type CreateDraftPromptsOut = OutputOf<"/api/v4/resources/prompts", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAgent = async (input: GetAgentIn): Promise<GetAgentOut> => {
  return api.post("/artifacts/agents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/agents/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/agents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/agents/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<Metadata> {
  const { agentId } = await params;
  const docs = await getDocs({ body: { entity_id: agentId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveAgent(input: SaveAgentIn): Promise<SaveAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/save", input);
}

// Prompts delete removed - no prompts delete functionality needed

async function patchAgentDraft(
  input: PatchAgentDraftIn
): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/agents/draft", input);
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
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "agent" })).group_id;

  // Fetch agent detail (always fresh - source of truth) with draft_id
  try {
    const input: GetAgentIn = {
      body: {
        agent_id: agentId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
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
          redirectPath="/intelligence/agents"
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
