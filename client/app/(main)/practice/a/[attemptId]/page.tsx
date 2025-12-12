/**
 * app/practice/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import type {
  AttemptFullIn,
  AttemptFullOut,
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
} from "@/app/(main)/home/a/[attemptId]/page";
import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { getSession } from "@/auth";
import { api } from "@/lib/api/client";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getAttemptFull = async (
  attemptId: string,
  input: AttemptFullIn,
): Promise<AttemptFullOut> => {
  return api.post("/attempts/full", input, {
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

  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  try {
    const attemptData = await getAttemptFull(attemptId, {
      body: { attemptId, profileId },
    });
    const simulationTitle = attemptData?.simulation?.["title"];
    return {
      title: `Practice ${simulationTitle || "Attempt"}`,
      description: `${simulationTitle ? `${simulationTitle} - ` : ""}Teaching practice session for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic simulation-based learning scenarios.`,
    };
  } catch {
    return {
      title: `Practice Attempt ${attemptId.substring(0, 8)}...`,
      description:
        "Teaching practice session for graduate teaching assistant training. Practice pedagogical techniques and student interaction strategies through realistic simulation-based learning scenarios.",
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateChatCreatedAt(
  input: UpdateChatCreatedAtIn,
): Promise<UpdateChatCreatedAtOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/attempts/chats/update-created-at", input);
}

/** ---- Page component ---- */
export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  // Fetch attempt data server-side
  try {
    const attemptData = await getAttemptFull(attemptId, {
      body: { attemptId, profileId },
    });

    return (
      <div className="space-y-6">
        <AttemptChat
          attemptId={attemptId}
          attemptData={attemptData}
          updateChatCreatedAtAction={updateChatCreatedAt}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (role-based access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <DepartmentAccessDenied
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
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
};
