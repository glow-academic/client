/**
 * app/create/simulations/new/page.tsx
 * New simulation creation page using the unified playground
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import NewSimulation from "@/components/create/simulations/NewSimulation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Simulation",
  description: "New simulation creation page using the unified playground in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewSimulationPage() {
  return (
    <div className="space-y-6">
      <NewSimulation />
    </div>
  );
}
