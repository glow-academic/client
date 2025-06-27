/**
 * AttemptInput.tsx
 * Used to display the attempt input. This will show the input field, with the microphone, end session and send message. It will properly handle loading states, and will call as needed the above functions for context.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import React, { useEffect, useRef, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Icons
import { Mic, MicOff, Send, Square } from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";

interface AttemptInputProps {
  attemptId: string;
}

export default function AttemptInput({ attemptId }: AttemptInputProps) {
  const {
    simulation,
    isActive,
    isSingleChatAttempt,
    currentChat,
    sendMessage,
    stopMessage,
    endChat,
    startRecording,
    stopRecording,
    isRecording,
    isTranscribing,
    webRtcError,
    lastTranscription,
    isWebRTCSupported,
    isSendingMessage,
    isStoppingMessage,
    endChatLoading,
  } = useSimulation();

  const [newMessage, setNewMessage] = useState("");
  const [isTall, setIsTall] = useState(false);

  const inputPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Handle form submission
  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement> | null,
    initialMessage?: string
  ) => {
    if (e) e.preventDefault();

    const messageToSend = initialMessage || newMessage.trim();
    if (!messageToSend || !currentChat || isSendingMessage) return;

    setNewMessage("");
    sendMessage(messageToSend);
  };

  // Handle stop message
  const handleStopMessage = async () => {
    stopMessage();
  };

  // Handle end chat
  const handleEndChat = async () => {
    endChat(attemptId);
  };

  // Handle WebRTC recording
  const handleStartRecording = async () => {
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
  };

  // Reset message when moving to next chat
  useEffect(() => {
    setNewMessage("");
  }, [currentChat?.id]);

  // Auto-focus typing functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only auto-focus if:
      // 1. Chat is not completed
      // 2. Session is active (if time-limited)
      // 3. Not pressing special keys (Ctrl, Alt, etc.)
      // 4. Not already focused on an input/textarea
      // 5. Key is a printable character
      if (
        !currentChat?.completed &&
        (simulation?.timeLimit ? isActive : true) &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        e.key.length === 1 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        textareaRef.current
      ) {
        // Focus the textarea and add the typed character
        textareaRef.current.focus();
        setNewMessage((prev) => prev + e.key);
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentChat?.completed, simulation?.timeLimit, isActive]);

  // ResizeObserver for input panel height detection
  useEffect(() => {
    if (!inputPanelRef.current) {
      return;
    }

    if (resizeObserverRef.current) {
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newIsTall = entry.contentRect.height > 160;
        setIsTall(newIsTall);
      }
    });

    ro.observe(inputPanelRef.current);
    resizeObserverRef.current = ro;

    // Initial measurement with a small delay to ensure layout is complete
    const measureTimer = setTimeout(() => {
      if (inputPanelRef.current) {
        const rect = inputPanelRef.current.getBoundingClientRect();
        const initialIsTall = rect.height > 160;
        setIsTall(initialIsTall);
      }
    }, 50);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      clearTimeout(measureTimer);
    };
  }); // No dependencies - run on every render until it succeeds

  // Don't render input if chat is completed
  if (currentChat?.completed) {
    return null;
  }

  return (
    <TooltipProvider>
      <CardFooter
        ref={inputPanelRef}
        className="h-full p-4 pt-3 pb-3 border-t flex flex-col justify-center min-h-0"
      >
        <div className="w-full h-full flex flex-col gap-2 min-h-[60px] pt-2 p-1">
          <form
            onSubmit={handleSendMessage}
            className={`flex flex-col gap-2 h-full ${isTall ? "" : "max-h-full overflow-hidden"}`}
          >
            {isTall ? (
              /* Vertical layout for larger panels with expanded textarea */
              <div className="flex flex-col gap-3 flex-1 p-1">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={simulation?.timeLimit ? !isActive : false}
                  className="flex-1 resize-y overflow-y-auto text-md"
                  data-testid="message-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(null);
                    }
                  }}
                  style={{
                    minHeight: "80px",
                    maxHeight: "300px",
                  }}
                />
                <div className="flex gap-2 justify-end">
                  {/* Microphone Button for WebRTC Audio - shows when no text */}
                  {isWebRTCSupported && !newMessage.trim() && (
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        !newMessage.trim()
                          ? "opacity-100 scale-100 translate-x-0"
                          : "opacity-0 scale-95 translate-x-2 pointer-events-none"
                      }`}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={isRecording ? "destructive" : "outline"}
                            onClick={
                              isRecording
                                ? handleStopRecording
                                : handleStartRecording
                            }
                            disabled={
                              currentChat?.completed ||
                              isTranscribing ||
                              (simulation?.timeLimit ? !isActive : false)
                            }
                            className={`min-h-[40px] h-[40px] px-3 ${
                              isTranscribing ? "animate-pulse" : ""
                            }`}
                            data-testid="mic-button"
                          >
                            {isTranscribing ? (
                              <div className="flex items-center space-x-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-1 h-1 bg-current rounded-full animate-pulse"
                                    style={{
                                      animationDelay: `${i * 0.2}s`,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : isRecording ? (
                              <>
                                <MicOff className="h-4 w-4" />
                                Stop Audio
                              </>
                            ) : (
                              <>
                                <Mic className="h-4 w-4" />
                                Start Audio
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isRecording
                              ? isTranscribing
                                ? "Processing audio..."
                                : "Stop audio recording"
                              : webRtcError
                                ? `Audio error: ${webRtcError}`
                                : "Start audio recording"}
                            {lastTranscription && (
                              <>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  Last: "{lastTranscription.slice(0, 50)}..."
                                </span>
                              </>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  {/* Send Button - shows when there is text */}
                  {newMessage.trim() && (
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        newMessage.trim()
                          ? "opacity-100 scale-100 translate-x-0"
                          : "opacity-0 scale-95 translate-x-2 pointer-events-none"
                      }`}
                    >
                      <Button
                        type="submit"
                        disabled={
                          isSendingMessage
                            ? isStoppingMessage
                            : !newMessage.trim() ||
                              (simulation?.timeLimit ? !isActive : false)
                        }
                        data-testid="send-button"
                        className="min-h-[40px] h-[40px] px-4"
                        variant={isSendingMessage ? "destructive" : "default"}
                        onClick={
                          isSendingMessage ? handleStopMessage : undefined
                        }
                      >
                        {isSendingMessage ? (
                          isStoppingMessage ? (
                            <LoadingDots />
                          ) : (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </>
                          )
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEndChat}
                    disabled={
                      endChatLoading ||
                      (simulation?.timeLimit ? !isActive : false)
                    }
                    className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
                  >
                    {endChatLoading
                      ? "Ending..."
                      : isSingleChatAttempt
                        ? "End Session"
                        : "End Chat"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Horizontal layout for smaller panels - original compact view */
              <div className="flex gap-2 flex-1 min-h-[40px] items-center p-2">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={simulation?.timeLimit ? !isActive : false}
                  className="flex-1 resize-none overflow-hidden text-md"
                  data-testid="message-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(null);
                    }
                  }}
                  style={{
                    height: "40px",
                    minHeight: "40px",
                    maxHeight: "40px",
                  }}
                />
                <div className="flex gap-2 shrink-0">
                  {/* Microphone Button for WebRTC Audio - shows when no text */}
                  {isWebRTCSupported && !newMessage.trim() && (
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        !newMessage.trim()
                          ? "opacity-100 scale-100 translate-x-0"
                          : "opacity-0 scale-95 translate-x-2 pointer-events-none"
                      }`}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={isRecording ? "destructive" : "outline"}
                            onClick={
                              isRecording
                                ? handleStopRecording
                                : handleStartRecording
                            }
                            disabled={
                              currentChat?.completed ||
                              isTranscribing ||
                              (simulation?.timeLimit ? !isActive : false)
                            }
                            className={`min-h-[40px] h-[40px] px-3 ${
                              isTranscribing ? "animate-pulse" : ""
                            }`}
                            data-testid="mic-button"
                          >
                            {isTranscribing ? (
                              <div className="flex items-center space-x-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-1 h-1 bg-current rounded-full animate-pulse"
                                    style={{
                                      animationDelay: `${i * 0.2}s`,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : isRecording ? (
                              <MicOff className="h-4 w-4" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isRecording
                              ? isTranscribing
                                ? "Processing audio..."
                                : "Stop audio recording"
                              : webRtcError
                                ? `Audio error: ${webRtcError}`
                                : "Start audio recording"}
                            {lastTranscription && (
                              <>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  Last: "{lastTranscription.slice(0, 50)}..."
                                </span>
                              </>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  {/* Send Button - shows when there is text */}
                  {newMessage.trim() && (
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        newMessage.trim()
                          ? "opacity-100 scale-100 translate-x-0"
                          : "opacity-0 scale-95 translate-x-2 pointer-events-none"
                      }`}
                    >
                      <Button
                        type="submit"
                        disabled={
                          isSendingMessage
                            ? isStoppingMessage
                            : !newMessage.trim() ||
                              (simulation?.timeLimit ? !isActive : false)
                        }
                        data-testid="send-button"
                        className="min-h-[40px] h-[40px] px-3"
                        variant={isSendingMessage ? "destructive" : "default"}
                        onClick={
                          isSendingMessage ? handleStopMessage : undefined
                        }
                      >
                        {isSendingMessage ? (
                          isStoppingMessage ? (
                            <LoadingDots />
                          ) : (
                            <Square className="h-4 w-4" />
                          )
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEndChat}
                    disabled={
                      endChatLoading ||
                      (simulation?.timeLimit ? !isActive : false)
                    }
                    className="whitespace-nowrap min-h-[40px] h-[40px] px-3 text-sm"
                  >
                    {endChatLoading
                      ? "Ending..."
                      : isSingleChatAttempt
                        ? "End Session"
                        : "End Chat"}
                  </Button>
                </div>
              </div>
            )}
          </form>
          {simulation?.timeLimit && !isActive && (
            <p className="text-sm text-muted-foreground text-center">
              Time's up! The session has ended.
            </p>
          )}
        </div>
      </CardFooter>
    </TooltipProvider>
  );
}
