/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Simulation from "@/components/simulations/Simulation";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SimulationDetailIn = InputOf<"/api/v3/simulations/detail", "post">;
type SimulationDetailOut = OutputOf<"/api/v3/simulations/detail", "post">;

type SimulationNewIn = InputOf<"/api/v3/simulations/new", "post">;
type SimulationNewOut = OutputOf<"/api/v3/simulations/new", "post">;

type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

type UpdateSimulationIn = InputOf<"/api/v3/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/api/v3/simulations/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulation = async (
  simulationId: string,
): Promise<SimulationDetailOut> => {
  return api.post(
    "/simulations/detail",
    { body: { simulationId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { simulationId } = await params;
  // profileId removed - comes from X-Profile-Id header automatically

  try {
    const simulation = await getSimulation(simulationId);
      return {
        title: `${simulation?.name || "Simulation"}`,
        description: `${simulation?.name ? `${simulation.name} - ` : ""}Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Simulation",
    description:
      "Teaching practice simulation for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic educational scenarios and simulation-based learning.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateSimulation(
  input: UpdateSimulationIn,
): Promise<UpdateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}) {
  const { simulationId } = await params;
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header automatically

  // Fetch simulation detail (always fresh - source of truth)
  try {
    const simulationDetail = await getSimulation(simulationId);

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
  SimulationNewIn,
  SimulationNewOut,
  SimulationDetailIn,
  SimulationDetailOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
};
