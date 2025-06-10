/**
 * Logs.tsx
 * Used to display the logs for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React from "react";
import SimulationHistory from "../common/history/SimulationHistory";
import { useViewMode } from "@/contexts/view-mode-context";

export default function Logs() {
  const { viewMode } = useViewMode();

  return (
    <div className="space-y-6">
      <SimulationHistory showAll={true} showChats={viewMode === "chats"} />
    </div>
  );
}
