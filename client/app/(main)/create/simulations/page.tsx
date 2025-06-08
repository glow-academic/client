/**
 * app/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 */
"use client";
import React from "react";
import { SimulationsContent } from "@/components/common/admin/simulations-content";

export default function SimulationsPage() {
  return (
    <div className="space-y-6">
      <SimulationsContent />
    </div>
  );
}
