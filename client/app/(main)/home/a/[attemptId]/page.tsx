/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { simulationRepo } from "@/lib/repos/simulationRepo";
import { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  // read route params
  const { attemptId } = await params;

  const attemptData = await simulationAttemptRepo.find(attemptId);
  if (!attemptData) {
    return {
      title: `Attempt ${attemptId.substring(0, 8)}...`,
      description: `Attempt ${attemptId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
  // get simulation for attempt
  const attemptSimulation = await simulationRepo.find(
    attemptData?.simulationId,
  );
  // Attempts don't have a title, so we'll use a generic name with timestamp
  return {
    title: `${attemptSimulation?.title || "Attempt"}`,
    description: `${attemptSimulation?.title || "Attempt"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function AttemptPage({}: {
  params: Promise<{ attemptId: string }>;
}) {
  return (
    <div className="space-y-6">
      <AttemptChat />
    </div>
  );
}
