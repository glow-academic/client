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

export interface AttemptInputProps {
  isAttemptOwner?: boolean;
}

export default function AttemptInput({
  isAttemptOwner = true,
}: AttemptInputProps) {
  const MAX_INPUT_CHARS = 5000; // generous limit to allow deep explanations without spam
  const simulationContext = useSimulation();
  const { isConnected } = useWebSocket();

  const [newMessage, setNewMessage] = useState("");

  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sanitizeInputLength = (value: string) =>
    value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

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

  // --- Handlers ---
  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>
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
      })
    );

    simulationContext?.sendMessage(messageToSend);
  };
  const handleStopMessage = () => simulationContext?.stopMessage();

  // --- Effects ---
  useEffect(() => {
    setNewMessage("");
  }, [simulationContext?.currentChat?.id]);

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
  if (simulationContext?.readOnly || simulationContext?.currentChat?.completed || !isAttemptOwner)
    return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full p-4 pb-2 border-t flex flex-col justify-end min-h-0"
      >
        {/* --- Persistent Bottom Bar --- */}
        <div className="w-full flex items-center gap-2 shrink-0">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) =>
                setNewMessage(sanitizeInputLength(e.target.value))
              }
              placeholder="Type your message..."
              disabled={simulationContext?.readOnly ? true : false}
              className="w-full text-md resize-none overflow-hidden h-10 min-h-10"
              maxLength={MAX_INPUT_CHARS}
              onPaste={(e) => {
                // Disable pasting into the input
                e.preventDefault();
              }}
              onDrop={(e) => {
                // Prevent drag-and-drop text insertion
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                // Block paste keyboard shortcuts (allow copy/cut)
                const isModifier = e.metaKey || e.ctrlKey;
                const key = e.key.toLowerCase();
                const isPaste =
                  (isModifier && key === "v") ||
                  (e.shiftKey && e.key === "Insert");
                if (isPaste) {
                  e.preventDefault();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) handleSendMessage(e);
              }}
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
    </TooltipProvider>
  );
}
