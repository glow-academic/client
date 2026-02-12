/**
 * app/(main)/practice/[attemptId]/page.tsx
 * Practice attempt page - uses the same endpoint as home.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import type {
  AttemptDetailIn,
  AttemptDetailOut,
} from "@/app/(main)/home/[attemptId]/page";
import { AttemptChat } from "@/components/artifacts/attempt/chat/setups/AttemptChat";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { Metadata, ResolvingMetadata } from "next";

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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const attemptData = await getAttemptDetail(attemptId);
    const simulationTitle = attemptData?.simulation?.name;
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
          redirectPath="/practice"
        />
      );
    }

    // New endpoint returns chats directly (no mapping needed)
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
  AttemptDetailIn,
  AttemptDetailOut,
};
