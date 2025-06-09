/**
 * app/create/simulations/new/page.tsx
 * New simulation creation page using the unified playground
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import Simulation from "@/components/common/simulation/Simulation";

export default function NewSimulationPage() {
  return (
    <div className="space-y-6">
      <Simulation mode="create" />
    </div>
  );
}
