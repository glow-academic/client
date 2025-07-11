/**
 * ScenarioEdit.tsx
 * Used to edit scenarios using the unified scenario component.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Scenario from "@/components/common/scenario/Scenario";

export interface ScenarioEditProps {
  scenarioId: string;
}

export default function ScenarioEdit({ scenarioId }: ScenarioEditProps) {
  return <Scenario scenarioId={scenarioId} mode="edit" />;
}
