/**
 * app/practice/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import type {
  AttemptFullIn,
  AttemptFullOut, 
} from "@/app/(main)/home/a/[attemptId]/page";
import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getAttemptFull = async (
  _attemptId: string,
  input: AttemptFullIn,
): Promise<AttemptFullOut> => {
  return api.post("/attempts/simulation", input, {
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const attemptData = await getAttemptFull(attemptId, {
      body: { attemptId },
    });
      const simulationTitle = attemptData?.simulation?.["title"];
      return {
        title: `Practice ${simulationTitle || "Attempt"}`,
        description: `${simulationTitle ? `${simulationTitle} - ` : ""}Teaching practice session for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic simulation-based learning scenarios.`,
      };
    } catch {
      // Fall through to default metadata
    }

  return {
    title: `Practice Attempt ${attemptId.substring(0, 8)}...`,
    description:
      "Teaching practice session for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic simulation-based learning scenarios.",
  };
}

/** ---- Page component ---- */
export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch attempt data server-side
  try {
    const attemptData = await getAttemptFull(attemptId, {
      body: { attemptId },
    });

    return (
      <div className="space-y-6">
        <AttemptChat
          attemptId={attemptId}
          attemptData={attemptData}
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
          redirectPath="/practice"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Re-export types for consistency (imported from home page) ---- */
export type {
  AttemptFullIn,
  AttemptFullOut,
};
