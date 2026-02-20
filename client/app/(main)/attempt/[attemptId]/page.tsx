/**
 * app/(main)/attempt/[attemptId]/page.tsx
 * Canonical attempt page — practice vs home is resolved from attempt data.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { AttemptChat } from "@/components/artifacts/attempt/chat/setups/AttemptChat";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AttemptDetailIn = InputOf<"/api/v4/artifacts/attempt/get", "post">;
type AttemptDetailOut = OutputOf<"/api/v4/artifacts/attempt/get", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 * Practice mode is determined server-side from the attempt data.
 */
const getAttemptDetail = async (
  attemptId: string,
): Promise<AttemptDetailOut> => {
  return api.post("/artifacts/attempt/get", {
    body: { attempt_id: attemptId },
  }, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { attemptId } = await params;

  try {
    const attemptData = await getAttemptDetail(attemptId);
    const simulationTitle = attemptData?.simulation?.name;
    return {
      title: `${simulationTitle || "Attempt"}`,
      description: `${simulationTitle ? `${simulationTitle} - ` : ""}Teaching practice session for graduate teaching assistant training. Review pedagogical performance, student interaction strategies, and teaching effectiveness through simulation-based learning assessment.`,
    };
  } catch {
    return {
      title: `Attempt ${attemptId.substring(0, 8)}...`,
      description:
        "Teaching practice session for graduate teaching assistant training. Review pedagogical performance, student interaction strategies, and teaching effectiveness through simulation-based learning assessment.",
    };
  }
}

/** ---- Page component ---- */
export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;
  const infiniteMode = sp["infiniteMode"] === "true";
  const rawInstructions = sp["userInstructions"];
  const userInstructions =
    typeof rawInstructions === "string" ? rawInstructions : null;

  try {
    const attemptData = await getAttemptDetail(attemptId);

    if (attemptData.access_denied) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="simulation"
          redirectPath="/home"
        />
      );
    }

    return (
      <div className="space-y-6">
        <AttemptChat
          attempt_id={attemptId}
          attempt_data={attemptData}
          draft_id={draftId}
          infinite_mode={infiniteMode}
          user_instructions={userInstructions}
        />
      </div>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="scenario"
          redirectPath="/home"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  AttemptDetailIn,
  AttemptDetailOut,
  AttemptDetailIn as AttemptFullIn,
  AttemptDetailOut as AttemptFullOut,
};
