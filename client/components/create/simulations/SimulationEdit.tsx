/**
 * SimulationEdit.tsx
 * Used to edit simulations using the unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import Simulation from "@/components/common/simulation/Simulation"

export default function SimulationEdit({ simulationId }: { simulationId: string }) {
  return <Simulation mode="list" simulationId={simulationId} />
}