/**
 * app/(main)/create/simulations/new/page.tsx
 * New simulation creation page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Simulation from "@/components/simulations/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type SimulationNewOut = OutputOf<"/api/v4/simulations/new", "post">;
type CreateSimulationIn = InputOf<"/api/v4/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v4/simulations/create", "post">;
type PatchSimulationDraftIn = InputOf<"/api/v4/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/simulations/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulationDefault = async (
  input: { body: { draft_id?: string | null } }
): Promise<SimulationNewOut> => {
  return api.post("/simulations/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSimulation(
  input: CreateSimulationIn,
): Promise<CreateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/create", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/simulations/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Simulation",
    description:
      "Create a new teaching practice simulation for graduate teaching assistant training. Design realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
  };
}

export default async function NewSimulationPage({
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

  // Inline server-side parsers for simulation search params
  const simulationSearchParams = {
    draftId: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Fetch default simulation detail server-side with draft_id
  const input = {
    body: {
      draft_id: q.draftId ?? null,
    },
  };
  const simulationDetailDefault = await getSimulationDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="simulation-new"
      aria-label="Create new simulation page"
    >
      <Simulation
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        simulationDetailDefault={simulationDetailDefault}
        createSimulationAction={createSimulation}
        patchSimulationDraftAction={patchSimulationDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateSimulationIn,
  CreateSimulationOut,
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
  SimulationNewOut,
};
