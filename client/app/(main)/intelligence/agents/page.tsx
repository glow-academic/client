/**
 * app/(main)/system/agents/page.tsx
 * System Agent list page - redirects to home with system agents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Agents from "@/components/agents/Agents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AgentsListOut = OutputOf<"/api/v4/artifacts/agents/list", "post">;
type DuplicateAgentIn = InputOf<"/api/v4/artifacts/agents/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/api/v4/artifacts/agents/duplicate", "post">;
type DeleteAgentIn = InputOf<"/api/v4/artifacts/agents/delete", "post">;
type DeleteAgentOut = OutputOf<"/api/v4/artifacts/agents/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getAgentsList = async (): Promise<AgentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/agents/list",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateAgent(
  input: DuplicateAgentIn,
): Promise<DuplicateAgentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/duplicate", input);
}

async function deleteAgent(input: DeleteAgentIn): Promise<DeleteAgentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Agents",
    description:
      "Manage AI agents for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
  };
}

export default async function AgentsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getAgentsList();

  return (
    <div className="space-y-6" data-page="agents-index">
      <Agents
        listData={listData}
        duplicateAgentAction={duplicateAgent}
        deleteAgentAction={deleteAgent}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
};
