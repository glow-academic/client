/**
 * SimulationEdit.tsx
 * Used to edit simulations using the unified simulation playground.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Simulation from "@/components/common/simulation/Simulation";

export interface SimulationEditProps {
  simulationId: string;
}

export default function SimulationEdit({
  simulationId,
}: SimulationEditProps) {
  return <Simulation simulationId={simulationId} />;
}
