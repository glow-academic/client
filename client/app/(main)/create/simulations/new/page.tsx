/**
 * app/(main)/create/simulations/new/page.tsx
 * New simulation creation page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Simulation from "@/components/simulations/Simulation";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SimulationNewOut = OutputOf<"/api/v3/simulations/new", "post">;
type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulationDefault = async (
  profileId: string,
): Promise<SimulationNewOut> => {
  return api.post(
    "/simulations/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSimulation(
  input: CreateSimulationIn,
): Promise<CreateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/create", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Simulation",
    description:
      "Create a new teaching practice simulation for graduate teaching assistant training. Design realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
  };
}

export default async function NewSimulationPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default simulation detail server-side (per-profile cache)
  const simulationDetailDefault = await getSimulationDefault(profileId);

  return (
    <div
      className="space-y-6"
      data-page="simulation-new"
      aria-label="Create new simulation page"
    >
      <Simulation
        simulationDetailDefault={simulationDetailDefault}
        createSimulationAction={createSimulation}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateSimulationIn, CreateSimulationOut, SimulationNewOut };
