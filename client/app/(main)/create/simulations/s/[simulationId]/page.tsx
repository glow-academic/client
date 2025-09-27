/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import SimulationEdit from "@/components/create/simulations/SimulationEdit";
import { use } from "react";

import { simulationRepo } from "@/lib/repos/simulationRepo";
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

export default function EditSimulationPage({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}) {
  const { simulationId } = use(params);

  return (
    <div className="space-y-6">
      <SimulationEdit simulationId={simulationId} />
    </div>
  );
}
