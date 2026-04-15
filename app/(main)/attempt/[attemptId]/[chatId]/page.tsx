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

/** ---- Strong types from OpenAPI ---- */
type ProblemAttemptIn = InputOf<"/attempt/problem", "post">;
type ProblemAttemptOut = OutputOf<"/attempt/problem", "post">;
type GetChatBundleOut = OutputOf<
  "/chat/get",
  "post"
>;
type PatchChatDraftIn = InputOf<
  "/attempt/draft",
  "patch"
>;
type PatchChatDraftOut = OutputOf<
  "/attempt/draft",
  "patch"
>;
type ContextIn = InputOf<"/chat/context", "post">;
type ContextOut = OutputOf<"/chat/context", "post">;

const getChatBundle = async (
  bundleId: string,
  attemptId: string,
  draftId: string | null,
): Promise<GetChatBundleOut> => {
  return api.post(
    "/chat/get",
    {
      body: {
        chat_entry_id: bundleId,
        attempt_id: attemptId,
        draft_id: draftId,
      },
    },
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
  return api.patch("/attempt/draft", input);
}

/** ---- Metadata uses context endpoint ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ attemptId: string; chatId: string }>;
}): Promise<Metadata> {
  const { chatId } = await params;

  try {
    const context = await api.post("/chat/context", { body: { entity_id: chatId } } as ContextIn) as ContextOut;
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

  // Profile + entity context in parallel
  const [bundleData, context] = await Promise.all([
    getChatBundle(chatId, attemptId, draftId),
    api.post("/chat/context", { body: { entity_id: chatId } } as ContextIn) as Promise<ContextOut>,
  ]);
  const snapshot = buildSnapshot(session, context.profile);

  const entityName = context.page_metadata?.detail.title;

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      sidebarProps={{
        activeSection: "practice",
        createFeedback: createAttemptProblem,
      }}
      breadcrumbs={[
        { title: "Attempt", url: `/attempt/${attemptId}` },
        { title: entityName || "Chat" },
      ]}
    >
      <div className="px-4">
        <Chat
          bundleData={bundleData as ChatData}
          patchChatDraftAction={patchChatDraft}
          attemptId={attemptId}
          chatEntryId={chatId}
        />
      </div>
    </FullPageLayout>
  );
}
