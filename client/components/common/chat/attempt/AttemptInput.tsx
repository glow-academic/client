/**
 * AttemptInput.tsx
 * Used to display the attempt input, supporting text, audio, and sketching.
 * @AshokSaravanan222 & @siladiea
 * 07/01/2025
 */
"use client";
import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Loader2, Send, Square } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSimulation } from "@/contexts/simulation-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { useHint } from "@/lib/api/hooks/hints";
import { log } from "@/utils/logger";
import HintDisplay from "../HintDisplay";

export interface AttemptInputProps {
  isAttemptOwner?: boolean;
  onHeightChange?: (height: number) => void;
}

export default function AttemptInput({
  isAttemptOwner = true,
  onHeightChange,
}: AttemptInputProps) {
  const MAX_INPUT_CHARS = 5000; // generous limit to allow deep explanations without spam
  const simulationContext = useSimulation();
  const { isConnected } = useWebSocket();

  const [newMessage, setNewMessage] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [hintsLoading, setHintsLoading] = useState(false);

  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { getHints, isLoading: hintsHookLoading } = useHint();

  const sanitizeInputLength = (value: string) =>
    value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

  // Initialize paste prevention hook
  const pastePrevention = useNoPasteTextarea(textareaRef, {
    onPasteAttempt: () => {
      // Optional: Add toast notification here
      log.info("paste.attempt.blocked", {
        message: "Paste attempt blocked",
        context: {
          component: "AttemptInput",
          function: "onPasteAttempt",
        },
      });
    },
    enableBurstDetection: true,
    maxBurstSize: 1,
  });

  // Connection state for send button
  const hasTextMessage = newMessage.trim().length > 0;

  const getConnectionTooltip = () => {
    if (!isConnected) {
      return "Initializing (0/1)";
    }
    if (simulationContext?.isSendingMessage) {
      return "Stop sending";
    }
    if (!hasTextMessage) {
      return "Enter a message";
    }
    return "Send message";
  };

  // Auto-generate hints when student sends a message
  const generateHintsForLatestMessage = useCallback(async () => {
    const currentChat = simulationContext?.currentChat;
    if (!currentChat || !simulationContext?.simulation?.practiceSimulation) {
      return;
    }

    const studentMessages = currentChat.messages?.filter(
      (msg) => msg.role === "user"
    );

    if (!studentMessages || studentMessages.length === 0) {
      return;
    }

    const lastStudentMessage = studentMessages[studentMessages.length - 1];

    try {
      setHintsLoading(true);
      const hints = await getHints({
        chat_id: currentChat.id,
        student_message: lastStudentMessage.content,
      });
      setHints(hints);
    } catch (error) {
      console.error("Hint error:", error);
      setHints([]);
    } finally {
      setHintsLoading(false);
    }
  }, [
    simulationContext?.currentChat,
    simulationContext?.simulation?.practiceSimulation,
    getHints,
  ]);

  // Watch for new student messages and auto-generate hints
  useEffect(() => {
    if (simulationContext?.currentChat?.messages) {
      const userMessages = simulationContext.currentChat.messages.filter(
        (msg) => msg.role === "user"
      );
      if (userMessages.length > 0) {
        generateHintsForLatestMessage();
      }
    }
  }, [simulationContext?.currentChat?.messages, generateHintsForLatestMessage]);

  const handleSelectHint = (hint: string) => {
    setNewMessage(hint);
    textareaRef.current?.focus();
  };

  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();

    // Require either text message or sketch to send
    if (
      !messageToSend ||
      !simulationContext?.currentChat ||
      simulationContext?.isSendingMessage ||
      !isConnected
    )
      return;

    setNewMessage("");

    // Dispatch messageSent event for tour progression and navigating state management
    window.dispatchEvent(
      new CustomEvent("messageSent", {
        detail: {
          message: messageToSend,
          chatId: simulationContext.currentChat.id,
          isTourMessage: false,
        },
      }),
    );

    simulationContext?.sendMessage(messageToSend);
  };
  const handleStopMessage = () => simulationContext?.stopMessage();

  // --- Effects ---
  useEffect(() => {
    setNewMessage("");
  }, [simulationContext?.currentChat?.id]);

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Notify parent of height change
      if (onHeightChange) {
        const maxTextareaHeight = 128; // max-h-32 = 8rem = 128px
        const actualTextareaHeight = Math.min(
          textarea.scrollHeight,
          maxTextareaHeight,
        );
        const totalHeight = actualTextareaHeight + 24; // Add padding (0px top + 8px bottom + 24px for button area)
        onHeightChange(Math.min(Math.max(totalHeight, 60), 160)); // Clamp between 60px and 160px
      }
    }
  }, [newMessage, onHeightChange]);

  // Initialize paste prevention previous value
  useEffect(() => {
    pastePrevention.updatePrevValue(newMessage);
  }, [newMessage, pastePrevention]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !simulationContext?.currentChat?.completed &&
        // Always allow input - don't disable based on timer
        true &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        textareaRef.current
      ) {
        textareaRef.current.focus();
        setNewMessage((prev) => sanitizeInputLength(prev + e.key));
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [simulationContext?.currentChat?.completed]);

  // Hide input if not the attempt owner or if read-only/completed
  if (
    simulationContext?.readOnly ||
    simulationContext?.currentChat?.completed ||
    !isAttemptOwner
  )
    return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full px-4 pb-2 pt-0 border-t flex flex-col justify-end min-h-0"
      >
        {/* --- Dynamic Input Area --- */}
        <div className="w-full flex items-end gap-2 shrink-0">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) =>
                pastePrevention.handleChange(e, (value) =>
                  setNewMessage(sanitizeInputLength(value)),
                )
              }
              placeholder="Type your $\Sigma$essage (LaTeX supported)"
              disabled={simulationContext?.readOnly ? true : false}
              className="w-full text-md resize-none overflow-y-auto text-base max-h-32"
              rows={1}
              maxLength={MAX_INPUT_CHARS}
              // Block paste/drop at the earliest stage
              onBeforeInput={pastePrevention.handleBeforeInput}
              onPaste={pastePrevention.handlePaste}
              onPasteCapture={pastePrevention.handlePasteCapture}
              onDrop={pastePrevention.handleDrop}
              // Kill context menu (mouse + long-press)
              onContextMenu={pastePrevention.handleContextMenu}
              // Block middle-click paste (Linux/X11 primary selection)
              onMouseDown={pastePrevention.handleMouseDown}
              onKeyDown={(e) =>
                pastePrevention.handleKeyDown(e, handleSendMessage)
              }
              // IME composition support
              onCompositionStart={pastePrevention.handleCompositionStart}
              onCompositionEnd={pastePrevention.handleCompositionEnd}
              // Reduce "smart" automatic inserts that look like paste/autofill
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="flex gap-2">
            {/* Always show the send/stop button, just disable as needed */}
            <motion.div
              layout
              key="send-btn-short"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    className="min-h-[40px] h-[40px] px-3"
                    variant={
                      simulationContext?.isSendingMessage
                        ? "destructive"
                        : "default"
                    }
                    disabled={
                      simulationContext?.readOnly ||
                      simulationContext?.isSendingMessage
                        ? simulationContext?.isStoppingMessage
                        : !isConnected || !hasTextMessage
                    }
                    onClick={
                      simulationContext?.isSendingMessage
                        ? handleStopMessage
                        : (e) => handleSendMessage(e)
                    }
                  >
                    {simulationContext?.isSendingMessage ? (
                      simulationContext?.isStoppingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                {getConnectionTooltip() && (
                  <TooltipContent>
                    <p>{getConnectionTooltip()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </motion.div>
          </div>
        </div>

        {/* Removed "Time's up!" message - allow users to continue with negative timer */}
      </CardFooter>

      {/* Hint Display Modal - Always visible for practice simulations */}
      {simulationContext?.simulation?.practiceSimulation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <HintDisplay
            hints={hints}
            isLoading={hintsLoading || hintsHookLoading}
            onClose={() => {}} // No close button needed since it's always visible
            onSelectHint={handleSelectHint}
          />
        </div>
      )}
    </TooltipProvider>
  );
}
