/**
 * app/home/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

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
type CreateQuizIn = InputOf<"/api/v3/attempts/quizzes/create", "post">;
type CreateQuizOut = OutputOf<"/api/v3/attempts/quizzes/create", "post">;
type SubmitQuizResponseIn = InputOf<
  "/api/v3/attempts/quizzes/submit-response",
  "post"
>;
type SubmitQuizResponseOut = OutputOf<
  "/api/v3/attempts/quizzes/submit-response",
  "post"
>;
type CompleteQuizIn = InputOf<"/api/v3/attempts/quizzes/complete", "post">;
type CompleteQuizOut = OutputOf<"/api/v3/attempts/quizzes/complete", "post">;

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
async function updateChatCreatedAt(
  input: UpdateChatCreatedAtIn,
): Promise<UpdateChatCreatedAtOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/attempts/chats/update-created-at", input);
}

async function createQuiz(input: CreateQuizIn): Promise<CreateQuizOut> {
  "use server";
  return api.post("/attempts/quizzes/create", input);
}

async function submitQuizResponse(
  input: SubmitQuizResponseIn,
): Promise<SubmitQuizResponseOut> {
  "use server";
  return api.post("/attempts/quizzes/submit-response", input);
}

async function completeQuiz(input: CompleteQuizIn): Promise<CompleteQuizOut> {
  "use server";
  return api.post("/attempts/quizzes/complete", input);
}

/** ---- Page component ---- */
export default async function AttemptPage({
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
          createQuizAction={createQuiz}
          submitQuizResponseAction={submitQuizResponse}
          completeQuizAction={completeQuiz}
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
        <DepartmentAccessDenied resourceType="scenario" redirectPath="/home" />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  AttemptFullIn,
  AttemptFullOut,
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
  CreateQuizIn,
  CreateQuizOut,
  SubmitQuizResponseIn,
  SubmitQuizResponseOut,
  CompleteQuizIn,
  CompleteQuizOut,
};
