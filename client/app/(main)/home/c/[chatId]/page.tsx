/**
 * app/home/c/[chatId]/page.tsx
 * Chat page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ChatDialog from "@/components/common/home/ChatDialog";
import { getAssistantChat } from "@/utils/queries/assistant_chats/get-assistant-chat";
import { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ chatId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { chatId } = await params;

  const chatData = await getAssistantChat(chatId);
  if (!chatData) {
    return {
      title: `Chat ${chatId.substring(0, 8)}...`,
      description: `Chat ${chatId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
    };
  }
  // Chats don't have a title, so we'll use a generic name with timestamp
  return {
    title: `${chatData?.title || "Chat"}`,
    description: `${chatData?.title || "Chat"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  return (
    <div className="space-y-6">
      <ChatDialog chatId={chatId} />
    </div>
  );
}
