/**
 * TextInput.tsx
 * Text entry component with paste prevention
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNoPasteTextarea } from "@/hooks/use-no-paste-textarea";
import { motion } from "framer-motion";
import { Loader2, Send, Square } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// Explicit, self-contained prop interface (like resource components)
export interface TextInputProps {
  enabled: boolean;
  copy_paste_allowed: boolean;
  on_send_message: (message: string) => void;
  on_stop_message: () => void;
  is_sending_message: boolean;
  is_stopping_message: boolean;
  is_connected: boolean;
  current_chat?: {
    id: string;
    completed?: boolean | null;
  } | null;
  disabled?: boolean;
  is_attempt_owner?: boolean;
  on_height_change?: (height: number) => void;
}

const MAX_INPUT_CHARS = 5000;

export function TextInput({
  enabled,
  copy_paste_allowed,
  on_send_message,
  on_stop_message,
  is_sending_message,
  is_stopping_message,
  is_connected,
  current_chat,
  disabled = false,
  is_attempt_owner = true,
  on_height_change,
}: TextInputProps) {
  const [newMessage, setNewMessage] = useState("");
  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sanitizeInputLength = (value: string) =>
    value.length > MAX_INPUT_CHARS ? value.slice(0, MAX_INPUT_CHARS) : value;

  // Initialize paste prevention hook
  const pastePrevention = useNoPasteTextarea(textareaRef, {
    enabled: !copy_paste_allowed,
    onPasteAttempt: () => {},
    enableBurstDetection: true,
    maxBurstSize: 1,
  });

  // Connection state for send button
  const hasTextMessage = newMessage.trim().length > 0;

  const getConnectionTooltip = () => {
    if (!is_connected) {
      return "Initializing (0/1)";
    }
    if (is_sending_message) {
      return "Stop sending";
    }
    if (!hasTextMessage) {
      return "Enter a message";
    }
    return "Send message";
  };

  const handleSendMessage = async (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const messageToSend = newMessage.trim();

    if (!messageToSend || !current_chat || !is_connected) return;
    if (is_sending_message) return;

    on_send_message(messageToSend);
    setNewMessage("");
  };

  const handleStopMessage = () => {
    on_stop_message();
  };

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Notify parent of height change
      if (on_height_change) {
        const maxTextareaHeight = 128;
        const actualTextareaHeight = Math.min(
          textarea.scrollHeight,
          maxTextareaHeight
        );
        const totalHeight = actualTextareaHeight + 24;
        const clampedHeight = Math.min(Math.max(totalHeight, 60), 160);
        on_height_change(clampedHeight);
      }
    }
  }, [newMessage, on_height_change]);

  // Initialize paste prevention previous value
  useEffect(() => {
    pastePrevention.updatePrevValue(newMessage);
  }, [newMessage, pastePrevention]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !current_chat?.completed &&
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
  }, [current_chat?.completed]);

  // Hide input if not enabled or not the attempt owner or if read-only/completed
  if (!enabled || disabled || current_chat?.completed || !is_attempt_owner)
    return null;

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full px-2 pb-1.5 pt-0 border-t flex flex-col justify-end min-h-0"
      >
        <div className="w-full flex items-end gap-2 shrink-0">
          <div className="flex-1 relative min-h-[40px] max-h-32 flex items-center">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) =>
                pastePrevention.handleChange(e, (value) =>
                  setNewMessage(sanitizeInputLength(value))
                )
              }
              placeholder="Type your message (LaTeX supported)"
              disabled={disabled}
              className="w-full text-md resize-none overflow-y-auto text-base max-h-32 min-h-[40px]"
              rows={1}
              maxLength={MAX_INPUT_CHARS}
              data-testid="attempt-chat-input"
              onBeforeInput={pastePrevention.handleBeforeInput}
              onPaste={pastePrevention.handlePaste}
              onPasteCapture={pastePrevention.handlePasteCapture}
              onDrop={pastePrevention.handleDrop}
              onContextMenu={pastePrevention.handleContextMenu}
              onMouseDown={pastePrevention.handleMouseDown}
              onKeyDown={(e) =>
                pastePrevention.handleKeyDown(e, handleSendMessage)
              }
              onCompositionStart={pastePrevention.handleCompositionStart}
              onCompositionEnd={pastePrevention.handleCompositionEnd}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="flex gap-2">
            {/* Show stop button when sending message */}
            {is_sending_message ? (
              <motion.div
                layout
                key="stop-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      className="min-h-[40px] h-[40px] px-3"
                      variant="destructive"
                      disabled={disabled || is_stopping_message}
                      onClick={handleStopMessage}
                      data-testid="attempt-stop-button"
                    >
                      {is_stopping_message ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stop sending</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ) : (
              <motion.div
                layout
                key="send-btn"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      className="min-h-[40px] h-[40px] px-3"
                      variant="default"
                      disabled={disabled || !is_connected || !hasTextMessage}
                      onClick={(e) => handleSendMessage(e)}
                      data-testid="attempt-send-button"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  {getConnectionTooltip() && (
                    <TooltipContent>
                      <p>{getConnectionTooltip()}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </motion.div>
            )}
          </div>
        </div>
      </CardFooter>
    </TooltipProvider>
  );
}
