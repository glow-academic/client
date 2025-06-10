/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import { use } from "react";
import ScenarioEdit from "@/components/create/scenarios/ScenarioEdit";

export default function EditScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = use(params);

  return (
    <div className="space-y-6">
      <ScenarioEdit scenarioId={scenarioId} />
    </div>
  );
}
