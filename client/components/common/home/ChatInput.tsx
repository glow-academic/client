/**
 * ChatInput.tsx
 * Chat input component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAssistant } from "@/contexts/assistant-context";
import { useRole } from "@/contexts/role-context";
import { Send, Square } from "lucide-react";
import { useEffect, useState } from "react";

export interface ChatInputProps {
  promptToSet?: string;
  onPromptSet?: () => void;
}

export default function ChatInput({
  promptToSet,
  onPromptSet,
}: ChatInputProps = {}) {
  const [message, setMessage] = useState("");
  const {
    sendMessage,
    stopMessage,
    isSendingMessage,
    isStoppingMessage,
    currentChatId,
  } = useAssistant();
  const { effectiveRole } = useRole();

  // Set message when promptToSet changes
  useEffect(() => {
    if (promptToSet) {
      setMessage(promptToSet);
      onPromptSet?.();
    }
  }, [promptToSet, onPromptSet]);

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const messageToSend = message.trim();
    setMessage("");
    await sendMessage(messageToSend);
  };

  const handleStop = async (e: React.FormEvent) => {
    e.preventDefault();
    await stopMessage();
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

  const placeholder = currentChatId
    ? "Type your message..."
    : "Start a conversation with the assistant...";

  const isDisabled = !message.trim();
  const buttonTitle = "Send";

  return (
    <form
      onSubmit={isSendingMessage ? handleStop : handleSubmit}
      className="p-3 bg-gradient-to-r from-gray-50/50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-700/50"
    >
      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSendingMessage}
          className="flex-1 resize-none min-h-[50px] max-h-[64px] border focus:border-blue-300 dark:focus:border-blue-600 transition-colors text-sm h-10"
          rows={2}
          style={{ height: "40px", maxHeight: "64px" }}
        />
        {isSendingMessage ? (
          <Button
            type="submit"
            disabled={isStoppingMessage}
            size="sm"
            className="shrink-0 h-10 w-10 p-0 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 flex items-center justify-center"
            variant="destructive"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isDisabled}
            title={buttonTitle}
            size="sm"
            className="shrink-0 h-10 w-10 p-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
