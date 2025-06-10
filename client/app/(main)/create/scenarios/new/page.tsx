/**
 * app/create/scenarios/new/page.tsx
 * New scenario creation page using the unified scenario component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";

import NewScenario from "@/components/create/scenarios/NewScenario";

export default function NewScenarioPage() {
  return (
    <div className="space-y-6">
      <NewScenario />
    </div>
  );

}
