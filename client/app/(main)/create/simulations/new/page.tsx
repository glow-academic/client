/**
 * app/create/simulations/new/page.tsx
 * New simulation creation page using the unified playground
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Simulation from "@/components/common/simulation/Simulation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Simulation",
  description: `New simulation creation page using the unified playground in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewSimulationPage() {
  return (
    <div className="space-y-6">
      <Simulation />
    </div>
  );
}
