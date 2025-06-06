/**
 * app/chat/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 */
"use client";

import { useParams } from "next/navigation";
import Simulation from "@/components/Simulation";

export default function EditSimulationPage() {
  const params = useParams();
  const simulationId = params.simulationId as string;

  return (
    <div className="space-y-6">
      <Simulation mode="create" simulationId={simulationId} />
    </div>
  );
}
