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
import { useEffect, useRef, useState } from "react"; // Import useRef

export interface ChatInputProps {
  promptToSet?: string;
  onPromptSet?: () => void;
}

export default function ChatInput({
  promptToSet,
  onPromptSet,
}: ChatInputProps = {}) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Create a ref for the textarea
  const {
    sendMessage,
    stopMessage,
    isSendingMessage,
    isStoppingMessage,
    currentChatId,
  } = useAssistant();
  const { effectiveRole } = useRole();

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // Reset height to shrink if needed
      textarea.style.height = `${textarea.scrollHeight}px`; // Set height to content size
    }
  }, [message]);

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
    ? "Type a message..."
    : "Start a conversation...";
  const isDisabled = !message.trim() || isSendingMessage;
  const buttonTitle = "Send";

  return (
    <form
      onSubmit={isSendingMessage ? handleStop : handleSubmit}
      className="p-3 border-t bg-background rounded-b-2xl"
    >
      {/* MODIFIED: Use a relative container to position the button inside */}
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSendingMessage}
          // MODIFIED: Styling for auto-growth, padding for button, and max height
          className="flex-1 resize-none overflow-y-auto pr-12 text-sm max-h-24"
          rows={1} // Start with 2 rows by default
        />
        {/* MODIFIED: Button is now absolutely positioned inside the relative container */}
        <div className="absolute bottom-1 right-1 flex flex-col gap-2">
          {isSendingMessage ? (
            <Button
              type="submit"
              disabled={isStoppingMessage}
              size="icon"
              className="shrink-0 h-7 w-7 p-0 bg-red-600 hover:bg-red-700"
              variant="destructive"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isDisabled}
              title={buttonTitle}
              size="icon"
              className="shrink-0 h-7 w-7 p-0 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
