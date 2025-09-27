/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import ScenarioEdit from "@/components/create/scenarios/ScenarioEdit";
import { use } from "react";

import { scenarioRepo } from "@/lib/repos/scenarioRepo";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { scenarioId } = await params;
  const scenario = await scenarioRepo.find(scenarioId);

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
