/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

// import Attempt from "@/components/common/chat/Attempt";
import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { SimulationProvider } from "@/contexts/simulation-context";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { attemptId } = await params;

  const attemptData = await getSimulationAttempt(attemptId);
  if (!attemptData) {
    return {
      title: `Attempt ${attemptId.substring(0, 8)}...`,
      description: `Attempt ${attemptId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
    };
  }
  // get simulation for attempt
  const attemptSimulation = await getSimulation(attemptData?.simulationId);
  // Attempts don't have a title, so we'll use a generic name with timestamp
  return {
    title: `${attemptSimulation?.title || "Attempt"}`,
    description: `${attemptSimulation?.title || "Attempt"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

export default function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);
  return (
    <div className="space-y-6">
      <SimulationProvider attemptId={attemptId}>
        <AttemptChat />
      </SimulationProvider>
      {/* <Attempt attemptId={attemptId} /> */}
    </div>
  );
}
