/**
 * app/c/[chatId]/page.tsx
 * Chat page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import Chat from "@/components/common/chat/Chat";
import { use } from "react";

export default function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  return (
    <div className="space-y-6">
      <Chat chatId={chatId} />
    </div>
  );
}
