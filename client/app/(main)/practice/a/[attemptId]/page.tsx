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
import { api } from "@/lib/api/client";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Cached fetch with Next tags ----
 * Cache key includes attemptId for per-attempt caching.
 * Tags allow revalidateTag("attempts") and revalidateTag(`attempt:${attemptId}`) to invalidate.
 */
const getAttemptFull = (attemptId: string) =>
  unstable_cache(
    async (input: AttemptFullIn): Promise<AttemptFullOut> => {
      return api.post("/attempts/full", input);
    },
    ["attempts:full", attemptId],
    { tags: ["attempts", `attempt:${attemptId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { attemptId } = await params;

  try {
    const attemptData = await getAttemptFull(attemptId)({
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateChatCreatedAt(
  input: UpdateChatCreatedAtIn,
): Promise<UpdateChatCreatedAtOut> {
  "use server";
  const out = await api.post("/attempts/chats/update-created-at", input);
  revalidateTag("attempts");
  const chatId = input.body?.chatId;
  if (chatId) {
    revalidateTag(`chat:${chatId}`);
  }
  return out;
}

/** ---- Server action to revalidate attempt cache when messages are sent ---- */
export async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Note: Chat-specific tags can be added here if chat IDs are known
  // For now, invalidating attempt-level cache ensures all chats refresh
}

/** ---- Page component ---- */
export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Fetch attempt data server-side
  const attemptData = await getAttemptFull(attemptId)({
    body: { attemptId },
  });

  return (
    <div className="space-y-6">
      <AttemptChat
        attemptId={attemptId}
        attemptData={attemptData}
        updateChatCreatedAtAction={updateChatCreatedAt}
        revalidateAttemptAction={revalidateAttempt}
      />
    </div>
  );
}

/** ---- Re-export types for consistency (imported from home page) ---- */
export type {
  AttemptFullIn,
  AttemptFullOut,
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
};
