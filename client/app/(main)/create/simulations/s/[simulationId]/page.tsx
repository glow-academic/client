/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Simulation from "@/components/simulations/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type SimulationDetailIn = InputOf<"/api/v3/simulations/detail", "post">;
type SimulationDetailOut = OutputOf<"/api/v3/simulations/detail", "post">;

type SimulationDetailDefaultIn = InputOf<
  "/api/v3/simulations/detail-default",
  "post"
>;
type SimulationDetailDefaultOut = OutputOf<
  "/api/v3/simulations/detail-default",
  "post"
>;

type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

type UpdateSimulationIn = InputOf<"/api/v3/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/api/v3/simulations/update", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getSimulation = (simulationId: string) =>
  unstable_cache(
    async (profileId: string): Promise<SimulationDetailOut> => {
      return api.post("/simulations/detail", {
        body: { simulationId, profileId },
      });
    },
    ["simulations:detail", simulationId],
    { tags: ["simulations", `simulation:${simulationId}`] }
  );

const getSimulationDefault = unstable_cache(
  async (profileId: string): Promise<SimulationDetailDefaultOut> => {
    return api.post("/simulations/detail-default", { body: { profileId } });
  },
  ["simulations:detail-default"],
  { tags: ["simulations"] }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { simulationId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const simulation = await getSimulation(simulationId)(profileId);
    return {
      title: `${simulation?.name || "Simulation"}`,
      description: `${simulation?.name || "Simulation"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Simulation",
      description: `Simulation in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createSimulation(
  input: CreateSimulationIn,
): Promise<CreateSimulationOut> {
  "use server";
  const out = await api.post("/simulations/create", input);
  revalidateTag("simulations");
  return out;
}

export async function updateSimulation(
  input: UpdateSimulationIn,
): Promise<UpdateSimulationOut> {
  "use server";
  const out = await api.post("/simulations/update", input);
  revalidateTag("simulations");
  const simulationId = input.body?.simulationId;
  if (simulationId) {
    revalidateTag(`simulation:${simulationId}`);
  }
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}) {
  const { simulationId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch simulation detail (cached, won't duplicate with metadata)
  const simulationDetail = await getSimulation(simulationId)(profileId);

  return (
    <div
      className="space-y-6"
      data-page="simulation-edit"
      data-simulation-id={simulationId}
    >
      <Simulation
        simulationId={simulationId}
        simulationDetail={simulationDetail}
        createSimulationAction={createSimulation}
        updateSimulationAction={updateSimulation}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateSimulationIn,
  CreateSimulationOut,
  SimulationDetailDefaultIn,
  SimulationDetailDefaultOut,
  SimulationDetailIn,
  SimulationDetailOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
};
