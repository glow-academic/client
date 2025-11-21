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
type SimulationDetailDefaultOut = OutputOf<
  "/api/v3/simulations/detail-default",
  "post"
>;
type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulationDefault = async (
  profileId: string
): Promise<SimulationDetailDefaultOut> => {
  return api.post(
    "/simulations/detail-default",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
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

export const metadata: Metadata = {
  title: "New Simulation",
  description: `New simulation creation page for the simulations section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

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
export type {
  CreateSimulationIn,
  CreateSimulationOut,
  SimulationDetailDefaultOut,
};
