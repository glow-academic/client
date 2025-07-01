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
import AudioWaveform from "./AudioWaveform";

export default function AttemptInput() {
  const simulationContext = useSimulation();

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
    if (!messageToSend || !simulationContext?.currentChat || simulationContext?.isSendingMessage) return;

    setNewMessage("");
    simulationContext?.sendMessage(messageToSend);
  };

  // Handle stop message
  const handleStopMessage = async () => {
    simulationContext?.stopMessage();
  };

  // Handle WebRTC recording
  const handleStartRecording = async () => {
    simulationContext?.startRecording();
  };

  const handleStopRecording = async () => {
    simulationContext?.stopRecording();
  };

  // Reset message when moving to next chat
  useEffect(() => {
    setNewMessage("");
  }, [simulationContext?.currentChat?.id]);

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
        !simulationContext?.currentChat?.completed &&
        (simulationContext?.simulation?.timeLimit ? simulationContext?.isActive : true) &&
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
  }, [simulationContext?.currentChat?.completed, simulationContext?.simulation?.timeLimit, simulationContext?.isActive]);

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
  }, []); // Empty dependency array to run only once

  // Don't render input if chat is completed
  if (simulationContext?.currentChat?.completed) {
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
              /* Vertical layout for larger panels */
              <div className="flex flex-col gap-3 flex-1 p-1">
                {!simulationContext?.isRecording && (
                  <Textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false}
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
                )}

                {/* 👇 2. USE THE SIMPLIFIED WAVEFORM COMPONENT */}
                {simulationContext?.isRecording && (
                  <AudioWaveform
                    isRecording={simulationContext?.isRecording}
                    isTall={isTall}
                    stream={simulationContext?.userAudioStream}
                  />
                )}

                <div className="flex gap-2 justify-end">
                  {/* Mic Button: Shows when not recording and no text */}
                  {simulationContext?.isWebRTCSupported && !newMessage.trim() && !simulationContext?.isRecording && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleStartRecording}
                          disabled={
                            simulationContext?.currentChat?.completed ||
                            (simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false)
                          }
                          className="min-h-[40px] h-[40px] px-3"
                          data-testid="mic-button"
                        >
                          <Mic className="h-4 w-4" />
                          <span className="ml-2">Start Audio</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Start audio recording</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Stop Recording Button: Shows when recording */}
                  {simulationContext?.isRecording && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleStopRecording}
                          className="min-h-[40px] h-[40px] px-3"
                          data-testid="mic-button"
                        >
                          <MicOff className="h-4 w-4" />
                          <span className="ml-2">Stop Audio</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stop audio recording</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Send Button: Shows when there is text and not recording */}
                  {newMessage.trim() && !simulationContext?.isRecording && (
                    <Button
                      type="submit"
                      disabled={
                        simulationContext?.isSendingMessage
                          ? simulationContext?.isStoppingMessage
                          : !newMessage.trim() ||
                            (simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false)
                      }
                      data-testid="send-button"
                      className="min-h-[40px] h-[40px] px-4"
                      variant={simulationContext?.isSendingMessage ? "destructive" : "default"}
                      onClick={simulationContext?.isSendingMessage ? handleStopMessage : undefined}
                    >
                      {simulationContext?.isSendingMessage ? (
                        simulationContext?.isStoppingMessage ? (
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
                  )}

                  {/* End Chat/Session Button */}
                  {/* <Button
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
                  </Button> */}
                </div>
              </div>
            ) : (
              /* Horizontal layout for smaller panels */
              <div className="flex gap-2 flex-1 min-h-[40px] items-center p-2">
                {!simulationContext?.isRecording && (
                  <Textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false}
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
                )}

                {simulationContext?.isRecording && (
                  <div className="w-full h-[40px]">
                    <AudioWaveform
                      isRecording={simulationContext?.isRecording}
                      isTall={isTall}
                      stream={simulationContext?.userAudioStream}
                    />
                  </div>
                )}

                <div
                  className={`flex gap-2 shrink-0 ${simulationContext?.isRecording ? "hidden" : ""}`}
                >
                  {/* Mic Button: Shows when not recording and no text */}
                  {simulationContext?.isWebRTCSupported && !newMessage.trim() && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleStartRecording}
                          disabled={
                            simulationContext?.currentChat?.completed ||
                            (simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false)
                          }
                          className="min-h-[40px] h-[40px] px-3"
                          data-testid="mic-button"
                        >
                          <Mic className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Start audio recording</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Send Button: Shows when there is text */}
                  {newMessage.trim() && (
                    <Button
                      type="submit"
                      disabled={
                        simulationContext?.isSendingMessage
                          ? simulationContext?.isStoppingMessage
                          : !newMessage.trim() ||
                            (simulationContext?.simulation?.timeLimit ? !simulationContext?.isActive : false)
                      }
                      data-testid="send-button"
                      className="min-h-[40px] h-[40px] px-3"
                      variant={simulationContext?.isSendingMessage ? "destructive" : "default"}
                      onClick={simulationContext?.isSendingMessage ? handleStopMessage : undefined}
                    >
                      {simulationContext?.isSendingMessage ? (
                        simulationContext?.isStoppingMessage ? (
                          <LoadingDots />
                        ) : (
                          <Square className="h-4 w-4" />
                        )
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* End Chat/Session Button */}
                  {/* <Button
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
                  </Button> */}
                </div>
                {/* Stop Recording Button for horizontal layout */}
                {simulationContext?.isRecording && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleStopRecording}
                        className="min-h-[40px] h-[40px] px-3"
                        data-testid="mic-button"
                      >
                        <MicOff className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Stop audio recording</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </form>
          {simulationContext?.simulation?.timeLimit && !simulationContext?.isActive && (
            <p className="text-sm text-muted-foreground text-center">
              Time's up! The session has ended.
            </p>
          )}
        </div>
      </CardFooter>
    </TooltipProvider>
  );
}
