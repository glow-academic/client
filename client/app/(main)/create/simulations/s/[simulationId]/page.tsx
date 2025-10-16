/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import SimulationEdit from "@/components/create/simulations/SimulationEdit";

import { auth } from "@/auth";
import { simulationsDetailKeys } from "@/lib/api/v2/keys";
import { fetchSimulationDetail } from "@/lib/api/v2/server/simulations";
import { simulationRepo } from "@/lib/repos/simulationRepo";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ simulationId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { simulationId } = await params;
  const simulation = await simulationRepo.find(simulationId);

  return {
    title: `${simulation?.title || "Simulation"}`,
    description: `${simulation?.title || "Simulation"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
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
    queryKey: simulationsDetailKeys.detail(simulationId, profileId),
    queryFn: () => fetchSimulationDetail(simulationId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <SimulationEdit simulationId={simulationId} />
      </div>
    </HydrationBoundary>
  );
}
