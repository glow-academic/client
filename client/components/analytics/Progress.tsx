/**
 * Progress.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React from "react";
import SimulationHistory from "../common/history/SimulationHistory";

export default function Progress() {
  return (
    <div className="space-y-6">
      <SimulationHistory showAll={true} />
    </div>
  );
}
