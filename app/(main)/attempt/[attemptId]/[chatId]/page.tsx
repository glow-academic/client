/**
 * app/(main)/attempt/[attemptId]/[chatId]/page.tsx
 * Canonical chat customization page (chat bundle).
 * Full SSR rendering with FullPageLayout — no generation panel (no generate/generations/problem).
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import Chat, { type ChatData } from "@/components/artifacts/chat/Chat";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { cache } from "react";
/** ---- Strong types from OpenAPI ---- */
type ProblemAttemptIn = InputOf<"/attempt/problem", "post">;
type ProblemAttemptOut = OutputOf<"/attempt/problem", "post">;
type GetChatBundleOut = OutputOf<
  "/attempt/chat_get",
  "post"
>;
type PatchChatDraftIn = InputOf<
  "/attempt/draft",
  "post"
>;
type PatchChatDraftOut = OutputOf<
  "/attempt/draft",
  "post"
>;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;

const getChatBundle = async (
  bundleId: string,
  attemptId: string,
  draftId: string | null,
): Promise<GetChatBundleOut> => {
  return api.post(
    "/attempt/chat_get",
    {
      body: {
        chat_entry_id: bundleId,
        attempt_id: attemptId,
        draft_id: draftId,
      },
    } as InputOf<"/attempt/chat_get", "post">,
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

async function createAttemptProblem(
  input: ProblemAttemptIn,
): Promise<ProblemAttemptOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

async function patchChatDraft(
  input: PatchChatDraftIn,
): Promise<PatchChatDraftOut> {
  "use server";
  return api.post("/attempt/draft", input);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAttemptContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/attempt/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Metadata uses context endpoint ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ attemptId: string; chatId: string }>;
}): Promise<Metadata> {
  const { chatId } = await params;

  try {
    const context = await getAttemptContextById(chatId);
    return {
      title: context.page_metadata?.detail.title ?? "Customize Training",
      description: context.page_metadata?.detail.description ?? "Customize and start a bundle-based training session.",
    };
  } catch {
    return {
      title: "Customize Training",
      description: "Customize and start a bundle-based training session.",
    };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string; chatId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId, chatId } = await params;
  const session = await getSession();
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;

  try {
    // Profile + entity context in parallel
    const [bundleData, context] = await Promise.all([
      getChatBundle(chatId, attemptId, draftId),
      getAttemptContextById(chatId) as Promise<ContextOut>,
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    const entityName = context.page_metadata?.detail.title;

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        {...(initialSidebarOpen !== undefined
          ? { initialSidebarOpen }
          : {})}
        sidebarProps={{
          activeSection: "practice",
          createFeedback: createAttemptProblem as unknown as (
            input: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>,
        }}
        breadcrumbs={[
          { title: "Attempt", url: `/attempt/${attemptId}` },
          { title: entityName || "Chat" },
        ]}
      >
        {/* Desktop-only gutter. On mobile the chat bubbles need the full
            horizontal room — the inner ScrollArea already provides 4px
            of breathing space on the edges. */}
        <div className="md:px-4">
          <Chat
            bundleData={bundleData as ChatData}
            patchChatDraftAction={patchChatDraft}
            attemptId={attemptId}
            chatEntryId={chatId}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      // 401 → not logged in. Attempt pages have no single-resource
      // department concept, so 403 doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={`/attempt/${attemptId}/${chatId}`}
        />
      );
    }
    throw error;
  }
}
