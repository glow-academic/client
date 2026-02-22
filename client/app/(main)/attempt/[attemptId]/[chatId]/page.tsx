/**
 * app/(main)/attempt/[attemptId]/[chatId]/page.tsx
 * Canonical chat customization page (chat bundle).
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ChatBundle, { type ChatBundleData } from "@/components/artifacts/chat/ChatBundle";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type GetChatBundleOut = OutputOf<
  "/api/v4/artifacts/chat/get",
  "post"
>;
type PatchChatDraftIn = InputOf<
  "/api/v4/artifacts/chat/draft",
  "patch"
>;
type PatchChatDraftOut = OutputOf<
  "/api/v4/artifacts/chat/draft",
  "patch"
>;

const getChatBundle = async (
  bundleId: string,
  draftId: string | null,
): Promise<GetChatBundleOut> => {
  return api.post(
    "/artifacts/chat/get",
    {
      body: {
        training_entry_id: bundleId,
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

async function patchChatDraft(
  input: PatchChatDraftIn,
): Promise<PatchChatDraftOut> {
  "use server";
  return api.patch("/artifacts/chat/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Training",
    description: "Customize and start a bundle-based training session.",
  };
}

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string; chatId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId, chatId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const bundleData = await getChatBundle(chatId, draftId);

  return (
    <ChatBundle
      bundleData={bundleData as ChatBundleData}
      patchChatDraftAction={patchChatDraft}
      attemptId={attemptId}
    />
  );
}
