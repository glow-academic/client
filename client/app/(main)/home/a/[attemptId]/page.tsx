/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;
type UpdateChatCreatedAtIn = InputOf<
  "/api/v3/attempts/chats/update-created-at",
  "post"
>;
type UpdateChatCreatedAtOut = OutputOf<
  "/api/v3/attempts/chats/update-created-at",
  "post"
>;

/** ---- Cached fetch with Next tags ----
 * Cache key includes attemptId for per-attempt caching.
 * Tags allow revalidateTag("attempts") and revalidateTag(`attempt:${attemptId}`) to invalidate.
 */
const getAttemptFull = unstable_cache(
  async (input: AttemptFullIn): Promise<AttemptFullOut> => {
    return api.post("/attempts/full", input);
  },
  ["attempts:full"],
  { tags: ["attempts"] }
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
      title: `${simulationTitle || "Attempt"}`,
      description: `${simulationTitle || "Attempt"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: `Attempt ${attemptId.substring(0, 8)}...`,
      description: `Attempt ${attemptId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateChatCreatedAt(
  input: UpdateChatCreatedAtIn
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

/** ---- Page component ---- */
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  // Fetch attempt data server-side
  const attemptData = await getAttemptFull({
    body: { attemptId },
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
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  AttemptFullIn,
  AttemptFullOut,
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
};
