/**
 * app/(main)/create/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { Simulations } from "@/components/simulations/Simulations";
import { getSession } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SimulationsListOut = OutputOf<"/api/v3/simulations/list", "post">;
type DuplicateSimulationIn = InputOf<"/api/v3/simulations/duplicate", "post">;
type DuplicateSimulationOut = OutputOf<"/api/v3/simulations/duplicate", "post">;
type DeleteSimulationIn = InputOf<"/api/v3/simulations/delete", "post">;
type DeleteSimulationOut = OutputOf<"/api/v3/simulations/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSimulationsList = async (
  profileId: string,
): Promise<SimulationsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/simulations/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateSimulation(
  input: DuplicateSimulationIn,
): Promise<DuplicateSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/duplicate", input);
}

async function deleteSimulation(
  input: DeleteSimulationIn,
): Promise<DeleteSimulationOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/simulations/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Simulations",
    description:
      "Manage teaching practice simulations for graduate teaching assistant training. Create and organize realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
  };
}

export default async function SimulationsPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getSimulationsList(profileId);

  return (
    <div className="space-y-6" data-page="simulations-index">
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
