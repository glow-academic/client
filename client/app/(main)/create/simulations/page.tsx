/**
 * app/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import { Simulations } from "@/components/create/simulations/Simulations";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulations",
  description: "Simulations in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function SimulationsPage() {
  return (
    <div className="space-y-6">
      <Simulations />
    </div>
  );
}
