/**
 * app/practice/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { SimulationProvider } from "@/contexts/simulation-context";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;

/** ---- Cached fetch (prevents duplicate requests) ---- */
const getAttemptFull = cache(
  async (input: AttemptFullIn): Promise<AttemptFullOut> => {
    return api.post("/attempts/full", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { attemptId } = await params;

  try {
    const attemptData = await getAttemptFull({
      body: { attemptId },
    });
    const simulationTitle = attemptData?.simulation?.["title"];
    return {
      title: `Practice ${simulationTitle || "Attempt"}`,
      description: `Practice ${simulationTitle || "Attempt"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: `Practice Attempt ${attemptId.substring(0, 8)}...`,
      description: `Practice Attempt ${attemptId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Page component ---- */
export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Fetch initial snapshot
  const initial = await getAttemptFull({
        body: { attemptId },
  });

  return (
    <SimulationProvider
      attemptId={attemptId}
      initial={initial}
    >
      <div className="space-y-6">
        <AttemptChat />
      </div>
    </SimulationProvider>
  );
}

/** ---- Export types for client (type-only imports) ---- */
export type { AttemptFullOut };
