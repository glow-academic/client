/**
 * Server component that fetches profile context data
 */
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LayoutContextIn = InputOf<"/api/v3/profile/context", "post">;
type LayoutContextOut = OutputOf<"/api/v3/profile/context", "post">;
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;
type MarkIntroCompleteIn = InputOf<
  "/api/v3/profile/mark-intro-complete",
  "post"
>;
type MarkIntroCompleteOut = OutputOf<
  "/api/v3/profile/mark-intro-complete",
  "post"
>;
type MarkChatCompleteIn = InputOf<"/api/v3/profile/mark-chat-complete", "post">;
type MarkChatCompleteOut = OutputOf<
  "/api/v3/profile/mark-chat-complete",
  "post"
>;

/** ---- Cached fetch ---- */
const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    return api.post("/profile/context", input);
  }
);

/** ---- Cached fetch for attempt data ---- */
const getAttemptFull = cache(
  async (input: AttemptFullIn): Promise<AttemptFullOut> => {
    return api.post("/attempts/full", input);
  }
);

/** ---- Export type for client (type-only imports) ---- */
export type LayoutContextResponse = LayoutContextOut;

export type SafeSessionSnapshot = {
  effectiveProfileId: string | null;
  fullEmulation: boolean;
  emulationTTL: number | null;
};

export async function getLayoutContextData() {
  const session = await auth();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  const snapshot: SafeSessionSnapshot = {
    effectiveProfileId: session?.effectiveProfileId ?? null,
    fullEmulation: !!session?.fullEmulation,
    emulationTTL: session?.emulationTTL ?? null,
  };

  const effectiveProfileId = session?.effectiveProfileId || "";
  const actualProfileId = session?.user?.profileId || "";

  // IMPORTANT: server overrides IDs internally; you still pass something for typing parity
  const initial = await getLayoutContext({
    body: {
      actualProfileId,
      effectiveProfileId,
      pathname: "/", // layout-level; pages can still supply their own on demand
    },
  });

  // Check if we're on an attempt page and fetch attempt data
  let attemptData: AttemptFullOut | null = null;
  const attemptMatch = pathname.match(/^\/(home|practice)\/a\/([^/]+)$/);
  const attemptId = attemptMatch?.[2] || null;

  if (attemptId) {
    try {
      attemptData = await getAttemptFull({
        body: { attemptId },
      });
    } catch (error) {
      // Silently fail - attempt data will be null if not available
      // eslint-disable-next-line no-console
      console.error("Failed to fetch attempt data in layout:", error);
    }
  }

  return { initial, snapshot, attemptData, attemptId };
}

/** ---- Strongly-typed server actions for TATour (single source of truth) ---- */
export async function markIntroComplete(
  input: MarkIntroCompleteIn
): Promise<MarkIntroCompleteOut> {
  "use server";
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";
  const out = await api.post("/profile/mark-intro-complete", {
    body: { ...input.body, profileId },
  });
  revalidateTag("profile");
  return out;
}

export async function markChatComplete(
  input: MarkChatCompleteIn
): Promise<MarkChatCompleteOut> {
  "use server";
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";
  const out = await api.post("/profile/mark-chat-complete", {
    body: { ...input.body, profileId },
  });
  revalidateTag("profile");
  return out;
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  MarkChatCompleteIn,
  MarkChatCompleteOut,
  MarkIntroCompleteIn,
  MarkIntroCompleteOut,
};
