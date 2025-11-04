/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { auth } from "@/auth";
import SimulationEdit from "@/components/create/simulations/SimulationEdit";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { simulationId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const simulation = await api.post("/simulations/detail", {
      body: { simulationId, profileId },
    });
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

export default async function EditSimulationPage({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}) {
  const { simulationId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch simulation detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.simulations.with({ simulationId, profileId }),
    queryFn: () =>
      api.post("/simulations/detail", {
        body: { simulationId, profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <SimulationEdit simulationId={simulationId} />
      </div>
    </HydrationBoundary>
  );
}
