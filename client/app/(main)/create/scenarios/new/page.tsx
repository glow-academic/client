/**
 * app/create/scenarios/new/page.tsx
 * New scenario creation page using the unified scenario component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import NewScenario from "@/components/create/scenarios/NewScenario";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Scenario",
  description: "New scenario creation page using the unified scenario component in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewScenarioPage() {
  return (
    <div className="space-y-6">
      <NewScenario />
    </div>
  );
}
