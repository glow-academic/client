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
import { Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ChatInputProps {
  promptToSet?: string;
  onPromptSet?: () => void;
  togglePrompt?: (value: boolean) => void;
}

export default function ChatInput({
  promptToSet,
  onPromptSet,
  togglePrompt,
}: ChatInputProps = {}) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    sendMessage,
    stopMessage,
    isSendingMessage,
    isStoppingMessage,
    currentChatId,
  } = useAssistant();

  // NEW: Global key listener to auto-focus the input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't hijack input for shortcuts (e.g., Ctrl+C)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Don't hijack if the user is already in an input field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Capture single, printable characters
      if (e.key.length === 1) {
        e.preventDefault(); // Stop the key from being used elsewhere
        textareaRef.current?.focus(); // Focus the chat textarea
        setMessage((prevMessage) => prevMessage + e.key); // Append the typed character
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);

    // Cleanup: remove the event listener when the component unmounts
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []); // Re-run this effect if `shouldShow` changes

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  // Set message when promptToSet changes
  useEffect(() => {
    if (promptToSet) {
      setMessage(promptToSet);
      onPromptSet?.();
    }
  }, [promptToSet, onPromptSet]);

  // Toggle prompt based on message content
  useEffect(() => {
    if (togglePrompt) {
      togglePrompt(!message.trim());
    }
  }, [message, togglePrompt]);

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
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSendingMessage}
          className="flex-1 resize-none overflow-y-auto pr-12 text-sm max-h-24"
          rows={1}
        />
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
