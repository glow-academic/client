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
type GetAgentIn = InputOf<"/api/v4/artifacts/agents/get", "post">;
type GetAgentOut = OutputOf<"/api/v4/artifacts/agents/get", "post">;
type SaveAgentIn = InputOf<"/api/v4/artifacts/agents/save", "post">;
type SaveAgentOut = OutputOf<"/api/v4/artifacts/agents/save", "post">;
type PatchAgentDraftIn = InputOf<"/api/v4/artifacts/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/api/v4/artifacts/agents/draft", "patch">;
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveAgent(input: SaveAgentIn): Promise<SaveAgentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/save", input);
}

async function patchAgentDraft(input: PatchAgentDraftIn): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/agents/draft", input);
}


async function createDraftReasoningLevels(input: CreateDraftReasoningLevelsIn): Promise<CreateDraftReasoningLevelsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/reasoning_levels", input);
}

async function createDraftTemperatureLevels(input: CreateDraftTemperatureLevelsIn): Promise<CreateDraftTemperatureLevelsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/temperature_levels", input);
}

async function createDraftVoices(input: CreateDraftVoicesIn): Promise<CreateDraftVoicesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/voices", input);
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
    descriptionSearch: parseAsString,
    promptSearch: parseAsString,
    instructionsSearch: parseAsString,
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  // Fetch default agent detail server-side with draft_id (agent_id = null for new mode)
  const input: GetAgentIn = {
    body: {
      agent_id: null,
      draft_id: q.draftId ?? null,
      descriptions_search: q.descriptionSearch ?? null,
      prompts_search: q.promptSearch ?? null,
      instructions_search: q.instructionsSearch ?? null,
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
        patchAgentDraftAction={patchAgentDraft}
        createReasoningLevelsAction={createDraftReasoningLevels}
        createTemperatureLevelsAction={createDraftTemperatureLevels}
        createVoicesAction={createDraftVoices}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { GetAgentIn, GetAgentOut, SaveAgentIn, SaveAgentOut };
