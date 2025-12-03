/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Simulation from "@/components/simulations/Simulation";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SimulationDetailIn = InputOf<"/api/v3/simulations/detail", "post">;
type SimulationDetailOut = OutputOf<"/api/v3/simulations/detail", "post">;

type SimulationNewIn = InputOf<
  "/api/v3/simulations/new",
  "post"
>;
type SimulationNewOut = OutputOf<
  "/api/v3/simulations/new",
  "post"
>;

type CreateSimulationIn = InputOf<"/api/v3/simulations/create", "post">;
type CreateSimulationOut = OutputOf<"/api/v3/simulations/create", "post">;

type UpdateSimulationIn = InputOf<"/api/v3/simulations/update", "post">;
type UpdateSimulationOut = OutputOf<"/api/v3/simulations/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSimulation = async (
  simulationId: string,
  profileId: string
): Promise<SimulationDetailOut> => {
  return api.post(
    "/simulations/detail",
    { body: { simulationId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { simulationId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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

  try {
    const simulation = await getSimulation(simulationId, profileId);
    return {
      title: `${simulation?.name || "Simulation"}`,
      description: `${simulation?.name || "Simulation"} in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Simulation",
      description: `Simulation in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSimulation(
  input: CreateSimulationIn,
): Promise<CreateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/create", input);
}

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
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch simulation detail (always fresh - source of truth)
  try {
    const simulationDetail = await getSimulation(simulationId, profileId);

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
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <DepartmentAccessDenied
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
