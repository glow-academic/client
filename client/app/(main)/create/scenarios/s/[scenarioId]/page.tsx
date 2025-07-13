/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { use } from "react";
import ScenarioEdit from "@/components/create/scenarios/ScenarioEdit";

import type { Metadata, ResolvingMetadata } from "next";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";


export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { scenarioId } = await params;
  const scenario = await getScenario(scenarioId);

  return {
    title: `${scenario?.name || "Scenario"}`,
    description: `${scenario?.name + " " + scenario?.description || "Scenario"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}



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
