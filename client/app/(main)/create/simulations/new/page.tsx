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
type SimulationNewOut = OutputOf<
  "/api/v3/simulations/new",
  "post"
>;
type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

type SearchScenarioIn = InputOf<"/api/v3/scenarios/search", "post">;
type SearchScenarioOut = OutputOf<"/api/v3/scenarios/search", "post">;

type SearchVideoIn = InputOf<"/api/v3/videos/search", "post">;
type SearchVideoOut = OutputOf<"/api/v3/videos/search", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulationDefault = async (
  profileId: string
): Promise<SimulationNewOut> => {
  return api.post(
    "/simulations/new",
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

async function searchScenarios(
  input: SearchScenarioIn,
): Promise<SearchScenarioOut> {
  "use server";
  return api.post("/scenarios/search", input);
}

async function searchVideos(
  input: SearchVideoIn,
): Promise<SearchVideoOut> {
  "use server";
  return api.post("/videos/search", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "New Simulation",
    description: `New simulation creation page for the simulations section in GLOW${orgPart}.`,
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
        searchScenarioAction={searchScenarios}
        searchVideoAction={searchVideos}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateSimulationIn,
  CreateSimulationOut,
  SimulationNewOut,
};
