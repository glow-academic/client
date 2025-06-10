/**
 * app/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import { Simulations } from "@/components/create/simulations/Simulations";

export default function SimulationsPage() {
  return (
    <div className="space-y-6">
      <Simulations />
    </div>
  );
}
