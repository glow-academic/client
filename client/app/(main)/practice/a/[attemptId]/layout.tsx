/**
 * Layout for practice attempt pages - fetches attemptFull and renders SimulationControls
 */
import { SimulationControls } from "@/components/common/chat/SimulationControls";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { unstable_cache } from "next/cache";
import type { ReactNode } from "react";

/** ---- Strong types from OpenAPI ---- */
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;

/** ---- Cached fetch with Next tags ---- */
const getAttemptFull = unstable_cache(
  async (input: AttemptFullIn): Promise<AttemptFullOut> => {
    return api.post("/attempts/full", input);
  },
  ["attempts:full"],
  { tags: ["attempts"] }
);

export default async function PracticeAttemptLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const attemptData = await getAttemptFull({
    body: { attemptId },
  });

  return (
    <>
      <SimulationControls attemptId={attemptId} attemptData={attemptData} />
      {children}
    </>
  );
}
