/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Agent from "@/components/artifacts/agent/Agent";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetAgentIn = InputOf<"/agents/get", "post">;
type GetAgentOut = OutputOf<"/agents/get", "post">;
type CreateAgentIn = InputOf<"/agents/create", "post">;
type CreateAgentOut = OutputOf<"/agents/create", "post">;
type PatchAgentDraftIn = InputOf<"/agents/draft", "patch">;
type PatchAgentDraftOut = OutputOf<"/agents/draft", "patch">;
type CreateDraftVoicesIn = InputOf<"/api/v5/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v5/resources/voices", "post">;

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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAgent(input: CreateAgentIn): Promise<CreateAgentOut> {
  "use server";
  return api.post("/agents/create", input);
}

async function patchAgentDraft(input: PatchAgentDraftIn): Promise<PatchAgentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/agents/draft", input);
}


async function createDraftVoices(input: CreateDraftVoicesIn): Promise<CreateDraftVoicesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/voices", input);
}
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/agents/docs", "post">;
type DocsOut = OutputOf<"/agents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/agents/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
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
  };
  const loadAgentSearchParams = createLoader(agentSearchParams);
  const q = loadAgentSearchParams(searchParamsObj);

  // Fetch default agent detail server-side with draft_id (agent_id = null for new mode)
  const input: GetAgentIn = {
    body: {
      agent_id: null,
      draft_id: q.draftId ?? null,
    } as GetAgentIn["body"],
  };
  const [agentDetailDefault, draftsResult] = await Promise.all([
    getAgent(input),
    api.post("/agents/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Agents", section: "agents", url: "/intelligence/agents" },
          { title: "New Agent" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="agent-new"
        aria-label="Create new agent page"
      >
        <Agent
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          agentDetailDefault={agentDetailDefault}
          createAgentAction={createAgent}
          patchAgentDraftAction={patchAgentDraft}
          createVoicesAction={createDraftVoices}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { GetAgentIn, GetAgentOut, CreateAgentIn, CreateAgentOut };
