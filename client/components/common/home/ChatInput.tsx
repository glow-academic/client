/**
 * ChatInput.tsx
 * Chat input component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { Send } from "lucide-react";
import { useState } from "react";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const { sendMessage, isSendingMessage, currentChatId } = useChat();
  const { effectiveRole } = useRole();

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentChatId) return;

    const messageToSend = message.trim();
    setMessage("");
    await sendMessage(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="p-3">
      <div className="flex gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            currentChatId
              ? "Type your message..."
              : "Create a chat to start messaging"
          }
          disabled={isSendingMessage || !currentChatId}
          className="flex-1 resize-none min-h-[40px] max-h-[120px]"
          rows={1}
        />
        <Button
          type="submit"
          disabled={!message.trim() || isSendingMessage || !currentChatId}
          size="sm"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {isSendingMessage && (
        <p className="text-xs text-muted-foreground mt-1">Sending...</p>
      )}
    </form>
  );
}
