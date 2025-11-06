/**
 * app/(main)/create/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { auth } from "@/auth";
import { Simulations } from "@/components/simulations/Simulations";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListIn = InputOf<"/api/v3/simulations/list", "post">;
type SimulationsListOut = OutputOf<"/api/v3/simulations/list", "post">;
type DuplicateSimulationIn = InputOf<"/api/v3/simulations/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/api/v3/simulations/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/api/v3/simulations/delete", "post">;
type DeleteSimulationOut = OutputOf<"/api/v3/simulations/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getSimulationsList = cache(
  async (input: SimulationsListIn): Promise<SimulationsListOut> => {
    return api.post("/simulations/list", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateSimulation(
  input: DuplicateSimulationIn,
): Promise<DuplicateSimulationOut> {
  "use server";
  const out = await api.post("/simulations/duplicate", input);
  revalidateTag("simulations");
  return out;
}

export async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  const out = await api.post("/simulations/delete", input);
  revalidateTag("simulations");
  return out;
}

export const metadata: Metadata = {
  title: "Simulations",
  description: `Simulations in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function SimulationsPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getSimulationsList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Simulations
        listData={listData}
        duplicateSimulationAction={duplicateSimulation}
        deleteSimulationAction={deleteSimulation}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteSimulationIn,
  DeleteSimulationOut,
  DuplicateSimulationIn,
  DuplicateSimulationOut,
  SimulationsListOut,
};
