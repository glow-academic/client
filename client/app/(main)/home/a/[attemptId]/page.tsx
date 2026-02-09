/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { AttemptChat } from "@/components/common/chat/setups/AttemptChat";
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
    // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

/** ---- Strongly-typed server actions (single source of truth) ---- */


/** ---- Page component ---- */
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch attempt data server-side
  try {
    const attemptData = await getAttemptDetail(attemptId);

    // Check access denied
    if (attemptData.access_denied) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="simulation"
          redirectPath="/home"
        />
      );
    }

    // New endpoint returns chats directly (no mapping needed)
    return (
      <div className="space-y-6">
        <AttemptChat
          attempt_id={attemptId}
          attempt_data={attemptData}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
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
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  AttemptDetailIn,
  AttemptDetailOut,
  // Backward compatibility aliases
  AttemptDetailIn as AttemptFullIn,
  AttemptDetailOut as AttemptFullOut,
};
