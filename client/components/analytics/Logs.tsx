/**
 * Logs.tsx
 * Used to display the logs for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React from "react";
import SimulationHistory from "../common/history/SimulationHistory";

export default function Logs() {

  return (
    <div className="space-y-6">
      <SimulationHistory
        showAll={true}
        showChats={false}
      />
    </div>
  );
}
