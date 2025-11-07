/**
 * app/(main)/system/agents/page.tsx
 * System Agent list page - redirects to home with system agents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { getSession } from "@/auth";

import Agents from "@/components/agents/Agents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type AgentsListIn = InputOf<"/api/v3/agents/list", "post">;
type AgentsListOut = OutputOf<"/api/v3/agents/list", "post">;
type DuplicateAgentIn = InputOf<"/api/v3/agents/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/api/v3/agents/duplicate", "post">;
type DeleteAgentIn = InputOf<"/api/v3/agents/delete", "post">;
type DeleteAgentOut = OutputOf<"/api/v3/agents/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getAgentsList = cache(
  async (input: AgentsListIn): Promise<AgentsListOut> => {
    return api.post("/agents/list", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateAgent(
  input: DuplicateAgentIn,
): Promise<DuplicateAgentOut> {
  "use server";
  const out = await api.post("/agents/duplicate", input);
  revalidateTag("agents");
  return out;
}

export async function deleteAgent(
  input: DeleteAgentIn,
): Promise<DeleteAgentOut> {
  "use server";
  const out = await api.post("/agents/delete", input);
  revalidateTag("agents");
  return out;
}

export const metadata: Metadata = {
  title: "Agents",
  description: `Agents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function AgentsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getAgentsList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
