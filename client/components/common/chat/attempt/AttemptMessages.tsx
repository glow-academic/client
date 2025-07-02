/**
 * AttemptMessages.tsx
 * Used to display the attempt messages. This will show the messages from the assistant, and the user. It will properly handle loading states, and will call as needed the above functions for context. It will eventually be able to play audio for each message and provide more custom streaming logic.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

// --- MODIFICATION START: Import new components and icons ---
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowDown,
  AudioWaveform,
  Captions,
  Loader2,
  Pause,
  Pencil, // Edit icon
  Play,
} from "lucide-react";
// --- MODIFICATION END ---

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

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
import { SimulationMessage } from "@/types";
import { deleteAudio } from "@/utils/api/audio/delete-audio";
import { logError, logInfo } from "@/utils/logger";
import { deleteSimulationMessage } from "@/utils/mutations/simulation_messages/delete-simulation-message";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";

// Word timing interface
interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface AttemptMessagesProps {
  chatId?: string;
}

// Component for audio with synchronized captions
function CaptionedAudio({
  message,
  timings,
  onPlayPause,
  isPlaying,
  isLoading,
}: {
  message: SimulationMessage;
  timings: WordTiming[];
  onPlayPause: () => void;
  isPlaying: boolean;
  isLoading: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeWordIndices, setActiveWordIndices] = useState<number[]>([]);

  // keep `activeWordIndices` in sync with playback position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || timings.length === 0) return;

    const handler = () => {
      const currentTime = audio.currentTime;

      // Find all words that should be highlighted at the current time
      const activeIndices: number[] = [];

      timings.forEach((timing, index) => {
        // Check if current time falls within this word's timing window
        // Add a small buffer (50ms) to make highlighting more visible
        const bufferTime = 0.05;
        if (
          currentTime >= timing.start - bufferTime &&
          currentTime <= timing.end + bufferTime
        ) {
          activeIndices.push(index);
        }
      });

      // Only update if the active indices have changed
      if (JSON.stringify(activeIndices) !== JSON.stringify(activeWordIndices)) {
        setActiveWordIndices(activeIndices);

        // Log for debugging
        if (activeIndices.length > 0) {
          const activeWords = activeIndices
            .map((i) => timings[i]?.word)
            .join(" ");
          logInfo(
            `Highlighting words at ${currentTime.toFixed(2)}s: "${activeWords}"`
          );
        }
      }
    };

    // Update more frequently for smoother highlighting
    audio.addEventListener("timeupdate", handler);

    // Also check on play/pause for immediate feedback
    audio.addEventListener("play", handler);
    audio.addEventListener("pause", handler);
    audio.addEventListener("seeked", handler);

    return () => {
      audio.removeEventListener("timeupdate", handler);
      audio.removeEventListener("play", handler);
      audio.removeEventListener("pause", handler);
      audio.removeEventListener("seeked", handler);
    };
  }, [timings, activeWordIndices]);

  // Sync audio element with external play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && audio.paused) {
      audio.play().catch((error) => {
        logError("Error playing audio:", error);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      logInfo("Audio playback started - word highlighting enabled");
    };

    const handlePause = () => {
      setActiveWordIndices([]); // Clear highlighting when paused
      logInfo("Audio paused - word highlighting cleared");
    };

    const handleEnded = () => {
      setActiveWordIndices([]); // Clear highlighting when ended
      logInfo("Audio ended - word highlighting cleared");
    };

    const handleLoadedMetadata = () => {
      logInfo(
        `Audio loaded: duration=${audio.duration?.toFixed(2)}s, timings=${timings.length} words`
      );

      // Validate that timings don't exceed audio duration
      if (timings.length > 0 && audio.duration) {
        const maxTimingEnd = Math.max(...timings.map((t) => t.end));
        if (maxTimingEnd > audio.duration) {
          logError(
            `Word timings extend beyond audio duration: ${maxTimingEnd}s > ${audio.duration}s`
          );
        }
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [timings]);

  return (
    <div className="bg-muted rounded-lg p-3 relative">
      <audio
        ref={audioRef}
        src={`/api/download/audio/${message.id}`}
        preload="metadata"
      />

      {/* Content with word highlighting */}
      <div className="pr-10">
        {timings.length > 0 ? (
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content.split(/\s+/).map((word, i) => {
              const isActive = activeWordIndices.includes(i);
              const timing = timings[i];

              return (
                <span
                  key={i}
                  className={`${
                    isActive
                      ? "bg-yellow-200 dark:bg-yellow-800 rounded px-1"
                      : ""
                  } transition-colors duration-150`}
                  title={
                    timing
                      ? `${timing.start.toFixed(2)}s - ${timing.end.toFixed(2)}s`
                      : undefined
                  }
                >
                  {word + " "}
                </span>
              );
            })}
          </p>
        ) : (
          <Markdown>{message.content}</Markdown>
        )}
      </div>

      {/* Play button */}
      <div className="absolute bottom-2 right-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onPlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Play Audio</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function AttemptMessages({ chatId }: AttemptMessagesProps) {
  const simulationContext = useSimulation();

  // --- MODIFICATION START: State for editing functionality ---
  const queryClient = useQueryClient();
  const [editingMessage, setEditingMessage] =
    useState<SimulationMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  // --- MODIFICATION END ---

  // Word timing state
  const [timingsByMsg, setTimingsByMsg] = useState<
    Record<string, WordTiming[]>
  >({});

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [audioState, setAudioState] = useState<{
    playingId: string | null;
    isLoading: boolean;
  }>({ playingId: null, isLoading: false });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const targetChatId = chatId || simulationContext?.currentChat?.id;

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["simulationMessages", targetChatId],
    queryFn: () => getSimulationMessagesByChat(targetChatId!),
    enabled: !!targetChatId,
  });

  // Listen for word timing events
  useEffect(() => {
    function handleTimings(
      e: CustomEvent<{
        message_id: string;
        chat_id: string;
        timings: WordTiming[];
      }>
    ) {
      const { message_id, timings } = e.detail;
      logInfo(
        `Received word timings for message: ${message_id} with ${timings?.length || 0} words`
      );

      // Enhanced logging for debugging
      if (timings && timings.length > 0) {
        const totalDuration = Math.max(...timings.map((t) => t.end));
        const avgWordDuration =
          timings.reduce((sum, t) => sum + (t.end - t.start), 0) /
          timings.length;

        logInfo(
          `Word timing stats: total_duration=${totalDuration.toFixed(2)}s, avg_word_duration=${avgWordDuration.toFixed(3)}s`
        );

        // Log first few and last few words for debugging
        const debugWords = [
          ...timings.slice(0, 3),
          ...(timings.length > 6 ? [{ word: "...", start: 0, end: 0 }] : []),
          ...timings.slice(-3),
        ];

        logInfo(
          `Word timings preview: ${JSON.stringify(
            debugWords.map((t) =>
              t.word === "..."
                ? "..."
                : `${t.word}(${t.start.toFixed(2)}-${t.end.toFixed(2)}s)`
            )
          )}`
        );
      }

      setTimingsByMsg((prev) => ({ ...prev, [message_id]: timings }));
    }

    window.addEventListener(
      "simulationWordTimings",
      handleTimings as EventListener
    );

    return () =>
      window.removeEventListener(
        "simulationWordTimings",
        handleTimings as EventListener
      );
  }, []);

  // Get the current streaming message or the latest completed assistant message for audio mode
  const currentDisplayMessage = useMemo(() => {
    const responseMessages = messages.filter(
      (msg: SimulationMessage) => msg.type === "response"
    );

    // First, check if there's a message currently streaming (not completed)
    const streamingMessage = responseMessages.find((msg) => !msg.completed);
    if (streamingMessage) {
      return streamingMessage;
    }

    // If no streaming message, return the latest completed message
    return (
      responseMessages
        .filter((msg) => msg.completed)
        .sort(
          (a: SimulationMessage, b: SimulationMessage) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0] || null
    );
  }, [messages]);

  // Check if assistant is currently speaking (streaming)
  const isAssistantSpeaking = useMemo(() => {
    return currentDisplayMessage && !currentDisplayMessage.completed;
  }, [currentDisplayMessage]);

  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];
    if (simulationContext?.classData?.classCode) {
      basePrompts.push(
        `Are you here for ${simulationContext?.classData.classCode}?`
      );
      return [
        "Hi, how are you?",
        "What can I help you with?",
        `Are you here for ${simulationContext?.classData.classCode}?`,
      ];
    }
    return basePrompts.slice(0, 3);
  }, [simulationContext?.classData?.classCode]);

  const handleStarterPromptClick = (prompt: string) =>
    simulationContext?.sendMessage(prompt);
  const handleAudioModeToggle = () => {
    const newAudioMode = !simulationContext?.assistantAudioEnabled;
    simulationContext?.setAssistantAudioEnabled(newAudioMode);
    if (newAudioMode) simulationContext?.testAndEnableAudio();
  };

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport)
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      setTimeout(() => setShowScrollButton(false), 300);
    }
  };

  const handlePlayPauseAudio = async (message: SimulationMessage) => {
    if (audioState.isLoading) return;
    if (audioState.playingId === message.id && audioRef.current) {
      audioRef.current.pause();
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    setAudioState({ playingId: message.id, isLoading: true });
    try {
      const audioUrl = `/api/download/audio/${message.id}`;
      const newAudio = new Audio(audioUrl);
      audioRef.current = newAudio;
      newAudio.oncanplaythrough = () => newAudio.play();
      newAudio.onplay = () =>
        setAudioState({ playingId: message.id, isLoading: false });
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

  // --- MODIFICATION START: Handlers for editing messages ---
  const handleEditClick = (message: SimulationMessage) => {
    setEditingMessage(message);
    setEditText(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const handleSaveEdit = () => {
    if (!editingMessage || editText.trim() === "") return;
    setConfirmDialogOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingMessage) return;

    setIsSubmittingEdit(true);

    try {
      // 1. Identify messages to delete (all after the editing message)
      const editTimestamp = new Date(editingMessage.updatedAt);
      const messagesToDelete = messages.filter(
        (msg) => new Date(msg.createdAt) > editTimestamp
      );

      // 2. Delete subsequent messages and their audio
      for (const msg of [...messagesToDelete, editingMessage]) {
        if (msg.type === "response" && msg.audio) {
          await deleteAudio(msg.id);
        }
        await deleteSimulationMessage(msg.id);
      }

      // 4. Invalidate query cache to refetch messages
      await queryClient.invalidateQueries({
        queryKey: ["simulationMessages", targetChatId],
      });

      // 5. Send the new message to get a new response
      simulationContext?.sendMessage(editText);
    } catch (error) {
      logError("Failed to edit and resubmit message", error);
    } finally {
      setIsSubmittingEdit(false);
      setConfirmDialogOpen(false);
      setEditingMessage(null);
      setEditText("");
    }
  };
  // --- MODIFICATION END ---

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [messages.length, messages]);

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
    return () => viewport.removeEventListener("scroll", handleScrollEvent);
  }, [messages.length, messages]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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
                variant={
                  simulationContext?.assistantAudioEnabled
                    ? "default"
                    : "outline"
                }
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

        {simulationContext?.assistantAudioEnabled && (
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

        {simulationContext?.assistantAudioEnabled ? (
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

            {captionsEnabled && currentDisplayMessage && (
              <div className="w-full max-w-4xl">
                <ScrollArea className="h-32 w-full border rounded-lg p-4 bg-background/80 backdrop-blur-sm">
                  <div className="text-lg leading-relaxed">
                    {!currentDisplayMessage.completed &&
                    currentDisplayMessage.content === "" ? (
                      <div className="flex items-center text-muted-foreground">
                        <span className="mr-2">Thinking...</span>
                        <LoadingDots />
                      </div>
                    ) : (
                      <>
                        <Markdown>{currentDisplayMessage.content}</Markdown>
                        {!currentDisplayMessage.completed && (
                          <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1" />
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4 min-h-0" ref={scrollAreaRef}>
              <div className="space-y-4 py-4">
                {messages.length === 0 ? (
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
                            simulationContext?.currentChat?.completed ||
                            simulationContext?.isSendingMessage ||
                            (simulationContext?.simulation?.timeLimit
                              ? !simulationContext?.isActive
                              : false)
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
                      (a, b) =>
                        new Date(a.createdAt).getTime() -
                        new Date(b.createdAt).getTime()
                    )
                    .map((message: SimulationMessage) => (
                      <div key={message.id} className="space-y-3">
                        {message.type === "query" && (
                          <div className="flex justify-end mb-3">
                            <div className="max-w-[80%]">
                              {/* --- MODIFICATION START: Conditional rendering for edit mode --- */}
                              {editingMessage?.id === message.id ? (
                                <div className="bg-primary/90 text-primary-foreground rounded-lg p-3 w-full">
                                  <Textarea
                                    value={editText}
                                    onChange={(e) =>
                                      setEditText(e.target.value)
                                    }
                                    className="bg-primary/10 text-primary-foreground border-primary-foreground/50 focus:ring-primary-foreground"
                                    autoFocus
                                    onFocus={(e) => e.currentTarget.select()}
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelEdit}
                                    >
                                      Cancel
                                    </Button>
                                    <Button size="sm" onClick={handleSaveEdit}>
                                      Send
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-primary text-primary-foreground rounded-lg p-3">
                                  {/* Edit button floated right, visible only on the LAST message */}
                                  {message.audio &&
                                    !simulationContext?.isSendingMessage && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="float-right ml-2 mb-1 h-7 w-7 hover:bg-primary-foreground/20"
                                            onClick={() =>
                                              handleEditClick(message)
                                            }
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Edit Transcript</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  <Markdown>{message.content}</Markdown>
                                </div>
                              )}
                              {/* --- MODIFICATION END --- */}
                            </div>
                          </div>
                        )}

                        {message.type === "response" && (
                          <div className="flex justify-start mb-3">
                            <div className="max-w-[80%]">
                              {/* Show loading state for empty/incomplete messages, otherwise show content */}
                              {!message.completed && message.content === "" ? (
                                <div className="bg-muted rounded-lg p-3">
                                  <div className="flex items-center">
                                    <span className="text-gray-500 mr-2">
                                      Analyzing
                                    </span>
                                    <LoadingDots />
                                  </div>
                                </div>
                              ) : message.audio ? (
                                <CaptionedAudio
                                  message={message}
                                  timings={timingsByMsg[message.id] || []}
                                  onPlayPause={() =>
                                    handlePlayPauseAudio(message)
                                  }
                                  isPlaying={
                                    audioState.playingId === message.id
                                  }
                                  isLoading={
                                    audioState.isLoading &&
                                    audioState.playingId === message.id
                                  }
                                />
                              ) : (
                                <div className="bg-muted rounded-lg p-3 relative">
                                  <Markdown>{message.content}</Markdown>
                                </div>
                              )}
                            </div>
                          </div>
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

      {/* --- MODIFICATION START: Alert Dialog for Edit Confirmation --- */}
      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently modify your message. All following messages
              in this conversation will be deleted, and the assistant will
              respond to your edited message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEdit}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmittingEdit}
            >
              {isSubmittingEdit ? "Sending..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* --- MODIFICATION END --- */}
    </div>
  );
}
