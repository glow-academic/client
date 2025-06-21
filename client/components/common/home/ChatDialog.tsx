/**
 * ChatDialog.tsx
 * Chat dialog component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import ChatWidget from "./ChatWidget";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

export default function ChatDialog({ chatId }: { chatId: string }) {
  return (
    <div>
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold">Chat {chatId.substring(0, 8)}...</h1>
      </div>
      <ChatWidget />
      <ChatMessages />
      <ChatInput />
    </div>
  );
}