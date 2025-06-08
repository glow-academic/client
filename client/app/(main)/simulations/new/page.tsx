/**
 * app/chat/simulations/new/page.tsx
 * Simulation creation page
 */
"use client";

import Simulation from "@/components/Simulation";

export default function NewSimulationPage() {
  return (
    <div className="space-y-6">
      <Simulation mode="create" />
    </div>
  );
}
