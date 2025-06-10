/**
 * app/create/simulations/s/[simulationId]/page.tsx
 * Simulation editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { use } from "react";
import SimulationEdit from "@/components/create/simulations/SimulationEdit";

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
