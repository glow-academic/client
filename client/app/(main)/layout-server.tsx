/**
 * Server component that fetches profile context data
 */
"use server";
import { getSession, update } from "@/auth";
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
type AssistantChatListIn = InputOf<"/api/v3/assistant/chats/list", "post">;
type AssistantChatListOut = OutputOf<"/api/v3/assistant/chats/list", "post">;
type AssistantChatFullIn = InputOf<"/api/v3/assistant/chats/full", "post">;
type AssistantChatFullOut = OutputOf<"/api/v3/assistant/chats/full", "post">;
type AuthorizeEmulationIn = InputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;
type AuthorizeEmulationOut = OutputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;
type CreateFeedbackIn = InputOf<"/api/v3/feedback/create", "post">;
type CreateFeedbackOut = OutputOf<"/api/v3/feedback/create", "post">;
type RefreshAnalyticsIn = InputOf<"/api/v3/analytics/refresh", "post">;
type RefreshAnalyticsOut = OutputOf<"/api/v3/analytics/refresh", "post">;

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
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  const snapshot: SafeSessionSnapshot = {
    effectiveProfileId: session?.effectiveProfileId ?? null,
    fullEmulation: !!session?.fullEmulation,
    emulationTTL: session?.emulationTTL ?? null,
  };

  const effectiveProfileId = session?.effectiveProfileId || "guest-profile-id";
  const actualProfileId = session?.user?.profileId || "guest-profile-id";

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
  const session = await getSession();
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
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";
  const out = await api.post("/profile/mark-chat-complete", {
    body: { ...input.body, profileId },
  });
  revalidateTag("profile");
  return out;
}

/** ---- Strongly-typed server actions for Assistant (single source of truth) ---- */
export async function getAssistantChatList(
  input: AssistantChatListIn
): Promise<AssistantChatListOut> {
  return api.post("/assistant/chats/list", input);
}

export async function getAssistantChatFull(
  input: AssistantChatFullIn
): Promise<AssistantChatFullOut> {
  return api.post("/assistant/chats/full", input);
}

/** ---- Strongly-typed server actions for Session Management (single source of truth) ---- */
type SwitchEffectiveProfileParams = {
  targetProfileId: string;
  fullEmulation?: boolean;
  emulationTTL?: number | null;
};

type SwitchEffectiveProfileResult = {
  ok: boolean;
  reason?: string;
};

async function authorizeEmulation(
  input: AuthorizeEmulationIn
): Promise<AuthorizeEmulationOut> {
  return api.post("/profile/authorize-emulation", input);
}

/**
 * Server action to switch the effective profile in the session.
 * This replaces client-side useSession().update() calls.
 * Uses server-side session mutation via NextAuth's unstable_update.
 */
export async function switchEffectiveProfile(
  input: SwitchEffectiveProfileParams
): Promise<SwitchEffectiveProfileResult> {
  try {
    const session = await getSession();
    if (!session?.user?.profileId) {
      return { ok: false, reason: "Unauthorized" };
    }

    const isSelf = input.targetProfileId === session.user.profileId;

    if (!isSelf) {
      const res = await authorizeEmulation({
        body: {
          requesterProfileId: session.user.profileId,
          targetProfileId: input.targetProfileId,
        },
      });

      if (!res.allowed) {
        return { ok: false, reason: res.reason ?? "Emulation not allowed" };
      }
    }

    // Update session server-side
    await update({
      effectiveProfileId: input.targetProfileId,
      fullEmulation: !!input.fullEmulation && !isSelf,
      emulationTTL: isSelf
        ? null
        : (input.emulationTTL ?? Date.now() + 2 * 60 * 60 * 1000),
    });

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

/** ---- Strongly-typed server actions for Feedback (single source of truth) ---- */
export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/feedback/create", input);
}

/** ---- Strongly-typed server actions for Analytics (single source of truth) ---- */
export async function refreshAnalytics(
  input: RefreshAnalyticsIn
): Promise<RefreshAnalyticsOut> {
  return api.post("/analytics/refresh", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AssistantChatFullIn,
  AssistantChatFullOut,
  AssistantChatListIn,
  AssistantChatListOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  MarkChatCompleteIn,
  MarkChatCompleteOut,
  MarkIntroCompleteIn,
  MarkIntroCompleteOut,
  RefreshAnalyticsIn,
  RefreshAnalyticsOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
