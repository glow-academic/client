/**
 * app/simulations/page.tsx
 * Simulation list page - redirects to home with simulations section
 */
"use client";
import React from "react";
import { SimulationsContent } from "@/components/admin/simulations-content";

export default function ChatSimulationsPage() {
  return (
    <div className="space-y-6">
      <SimulationsContent />
    </div>
  );
}
