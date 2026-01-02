/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Simulation from "@/components/simulations/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type SimulationDetailIn = InputOf<"/api/v4/simulations/detail", "post">;
type SimulationDetailOut = OutputOf<"/api/v4/simulations/detail", "post">;

type SimulationNewIn = InputOf<"/api/v4/simulations/new", "post">;
type SimulationNewOut = OutputOf<"/api/v4/simulations/new", "post">;

type CreateSimulationIn = InputOf<"/api/v4/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v4/simulations/create", "post">;

type UpdateSimulationIn = InputOf<"/api/v4/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/api/v4/simulations/update", "post">;
type PatchSimulationDraftIn = InputOf<"/api/v4/simulations/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/api/v4/simulations/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulation = async (
  input: SimulationDetailIn
): Promise<SimulationDetailOut> => {
  return api.post("/simulations/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { simulationId } = await params;
  // profileId removed - comes from X-Profile-Id header automatically

  try {
    const input: SimulationDetailIn = {
      body: {
        simulation_id: simulationId,
        draft_id: null,
      } as SimulationDetailIn["body"],
    };
    const simulation = await getSimulation(input);
    return {
      title: `${simulation?.name || "Simulation"}`,
      description: `${simulation?.name ? `${simulation.name} - ` : ""}Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Simulation",
    description:
      "Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateSimulation(
  input: UpdateSimulationIn
): Promise<UpdateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/update", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/simulations/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ simulationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { simulationId } = await params;
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header automatically
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

  // Inline server-side parsers for simulation search params
  const simulationSearchParams = {
    draftId: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Fetch simulation detail (always fresh - source of truth) with draft_id
  try {
    const input: SimulationDetailIn = {
      body: {
        simulation_id: simulationId,
        draft_id: q.draftId ?? null,
      } as SimulationDetailIn["body"],
    };
    const simulationDetail = await getSimulation(input);

    return (
      <div
        className="space-y-6"
        data-page="simulation-edit"
        data-simulation-id={simulationId}
      >
        <Simulation
          simulationId={simulationId}
          simulationDetail={simulationDetail}
          updateSimulationAction={updateSimulation}
          patchSimulationDraftAction={patchSimulationDraft}
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
          resourceType="simulation"
          redirectPath="/create/simulations"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateSimulationIn,
  CreateSimulationOut,
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
  SimulationDetailIn,
  SimulationDetailOut,
  SimulationNewIn,
  SimulationNewOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
};
