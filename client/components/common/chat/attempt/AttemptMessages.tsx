/**
 * AttemptMessages.tsx
 * Used to display the attempt messages. This will show the messages from the assistant, and the user. It will properly handle loading states, and will call as needed the above functions for context. It will eventually be able to play audio for each message and provide more custom streaming logic.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// Icons
// --- MODIFICATION START: Added new icons for audio playback ---
import {
  ArrowDown,
  AudioWaveform,
  Captions,
  Loader2,
  Play,
  Pause,
} from "lucide-react";
// --- MODIFICATION END ---

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import Markdown from "@/components/common/chat/Markdown";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";
import { Simulation, SimulationMessage } from "@/types";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { logError } from "@/utils/logger";

interface AttemptMessagesProps {
  simulation: Simulation | null;
  isActive: boolean;
  chatId?: string; // Optional override for which chat to show messages for
}

export default function AttemptMessages({
  simulation,
  isActive,
  chatId,
}: AttemptMessagesProps) {
  const {
    currentChat,
    classData,
    sendMessage,
    isSendingMessage,
    assistantAudioEnabled,
    setAssistantAudioEnabled,
    testAndEnableAudio,
  } = useSimulation();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // --- MODIFICATION START: State for managing individual audio playback ---
  const [audioState, setAudioState] = useState<{
    playingId: string | null;
    isLoading: boolean;
  }>({
    playingId: null,
    isLoading: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // --- MODIFICATION END ---

  // Use the provided chatId or fall back to currentChat
  const targetChatId = chatId || currentChat?.id;

  // Fetch messages for target chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["simulationMessages", targetChatId],
    queryFn: () => getSimulationMessagesByChat(targetChatId!),
    enabled: !!targetChatId,
  });

  // Get the latest assistant message for audio mode
  const latestAssistantMessage = useMemo(() => {
    return messages
      .filter((msg: SimulationMessage) => msg.type === "response")
      .sort(
        (a: SimulationMessage, b: SimulationMessage) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
  }, [messages]);

  // Check if assistant is currently speaking (streaming)
  const isAssistantSpeaking = useMemo(() => {
    return latestAssistantMessage && !latestAssistantMessage.completed;
  }, [latestAssistantMessage]);

  // Generate starter prompts
  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];

    if (classData?.classCode) {
      basePrompts.push(`Are you here for ${classData.classCode}?`);
    }

    if (classData?.classCode) {
      return [
        "Hi, how are you?",
        "What can I help you with?",
        `Are you here for ${classData.classCode}?`,
      ];
    }

    return basePrompts.slice(0, 3);
  }, [classData?.classCode]);

  // Handle starter prompt click
  const handleStarterPromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  // Handle audio mode toggle with audio testing
  const handleAudioModeToggle = () => {
    const newAudioMode = !assistantAudioEnabled;
    setAssistantAudioEnabled(newAudioMode);
    if (newAudioMode) {
      testAndEnableAudio();
    }
  };

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        setTimeout(() => setShowScrollButton(false), 300);
      }
    }
  };

  // --- MODIFICATION START: Function to handle playing/pausing audio ---
  const handlePlayPauseAudio = async (message: SimulationMessage) => {
    // If clicking the loading button, do nothing.
    if (audioState.isLoading) return;

    // If clicking the currently playing message, pause it.
    if (audioState.playingId === message.id && audioRef.current) {
      audioRef.current.pause();
      return;
    }

    // If another audio is playing, stop it before starting the new one.
    if (audioRef.current) {
      audioRef.current.pause();
    }

    setAudioState({ playingId: message.id, isLoading: true });

    try {
      const audioUrl = `/api/download/audio/${message.id}`;
      const newAudio = new Audio(audioUrl);
      audioRef.current = newAudio;

      newAudio.oncanplaythrough = () => {
         newAudio.play();
      };
      
      newAudio.onplay = () => {
        setAudioState({ playingId: message.id, isLoading: false });
      };

      newAudio.onpause = newAudio.onended = () => {
        setAudioState({ playingId: null, isLoading: false });
        audioRef.current = null;
      };

      newAudio.onerror = (e) => {
        logError("Error playing audio:", e);
        setAudioState({ playingId: null, isLoading: false });
        audioRef.current = null;
      };
    } catch (error) {
      logError("Failed to set up audio:", error);
      setAudioState({ playingId: null, isLoading: false });
    }
  };
  // --- MODIFICATION END ---

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [messages.length]);

  // Set up scroll event listener for the ScrollArea
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    if (!viewport) return;

    const handleScrollEvent = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      const hasScrollableContent = scrollHeight > clientHeight + 10;
      setShowScrollButton(hasScrollableContent && !isNearBottom);
    };

    handleScrollEvent();
    viewport.addEventListener("scroll", handleScrollEvent);

    return () => {
      viewport.removeEventListener("scroll", handleScrollEvent);
    };
  }, [messages.length]);

  // --- MODIFICATION START: Cleanup audio on component unmount ---
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  // --- MODIFICATION END ---

  if (messagesLoading) {
    return (
      <div className="flex-1 flex flex-col p-0 min-h-0 relative">
        <ScrollArea className="flex-1 px-4 min-h-0">
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-0 min-h-0 relative">
      <TooltipProvider>
        <div className="absolute top-4 left-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={assistantAudioEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleAudioModeToggle}
                className="p-2"
              >
                <AudioWaveform className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Audio Mode</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {assistantAudioEnabled && (
          <div className="absolute top-4 right-4 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={captionsEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  className="p-2"
                >
                  <Captions className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Captions</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {assistantAudioEnabled ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-8">
            <div className="relative mb-8">
              <div
                className={`w-[300px] h-[300px] rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 ${
                  isAssistantSpeaking ? "animate-pulse" : ""
                }`}
                style={{
                  background: isAssistantSpeaking
                    ? "linear-gradient(135deg, #60a5fa, #a855f7, #ec4899)"
                    : "linear-gradient(135deg, #94a3b8, #64748b, #475569)",
                }}
              />
            </div>

            {captionsEnabled && latestAssistantMessage && (
              <div className="w-full max-w-4xl">
                <ScrollArea className="h-32 w-full border rounded-lg p-4 bg-background/80 backdrop-blur-sm">
                  <div className="text-lg leading-relaxed">
                    <Markdown>{latestAssistantMessage.content}</Markdown>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 min-h-0" ref={scrollAreaRef}>
              <div className="space-y-4 py-4">
                {messagesLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ))}
                  </>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Choose a prompt below or type your own message
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full max-w-md">
                      {starterPrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="h-auto p-4 text-left justify-start whitespace-normal"
                          onClick={() => handleStarterPromptClick(prompt)}
                          disabled={
                            currentChat?.completed ||
                            isSendingMessage ||
                            (simulation?.timeLimit ? !isActive : false)
                          }
                        >
                          <span className="text-sm">{prompt}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages
                    .sort(
                      (a: SimulationMessage, b: SimulationMessage) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime()
                    )
                    .map((message: SimulationMessage) => (
                      <div key={message.id} className="space-y-3">
                        {message.type === "query" && (
                          <div className="flex justify-end mb-3">
                            <div className="max-w-[80%]">
                              <div className="bg-primary text-primary-foreground rounded-lg p-3">
                                <Markdown>{message.content}</Markdown>
                              </div>
                            </div>
                          </div>
                        )}

                        {message.type === "response" &&
                          message.content !== "" && (
                            // --- MODIFICATION START: Flex container for message and play button ---
                            <div className="flex items-start gap-2 justify-start mb-3">
                              {/* NOTE: Assumes `message.audio` is a boolean indicating if audio is available. 
                                  You may need to adjust the `SimulationMessage` type and your data fetching. */}
                              {message.audio && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="flex-shrink-0 h-9 w-9 mt-1"
                                      onClick={() => handlePlayPauseAudio(message)}
                                      disabled={audioState.isLoading && audioState.playingId !== message.id}
                                    >
                                      {audioState.isLoading && audioState.playingId === message.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                      ) : audioState.playingId === message.id ? (
                                        <Pause className="h-5 w-5" />
                                      ) : (
                                        <Play className="h-5 w-5" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Play Audio</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <div className="max-w-[calc(100%-44px)]">
                                <div className="bg-muted rounded-lg p-3">
                                  {message.content === "" ? (
                                    <div className="flex items-center">
                                      <span className="text-gray-500 mr-2">
                                        Analyzing
                                      </span>
                                      <LoadingDots />
                                    </div>
                                  ) : (
                                    <Markdown>{message.content}</Markdown>
                                  )}
                                </div>
                              </div>
                            </div>
                            // --- MODIFICATION END ---
                          )}
                      </div>
                    ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div
              className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 transition-all duration-300 ease-in-out ${
                showScrollButton
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <Button
                variant="default"
                size="sm"
                onClick={scrollToBottom}
                className="rounded-full h-10 w-10 p-0 shadow-lg bg-primary hover:bg-primary/90 border-2 border-background"
                data-testid="scroll-to-bottom-button"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </TooltipProvider>
    </div>
  );
}