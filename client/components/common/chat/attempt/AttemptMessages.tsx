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
import { Simulation, SimulationMessage } from "@/types";
import { deleteAudio } from "@/utils/api/audio/delete-audio";
import { logError } from "@/utils/logger";
import { deleteSimulationMessage } from "@/utils/mutations/simulation_messages/delete-simulation-message";
import { updateSimulationMessage } from "@/utils/mutations/simulation_messages/update-simulation-message";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";

interface AttemptMessagesProps {
  simulation: Simulation | null;
  isActive: boolean;
  chatId?: string;
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

  // --- MODIFICATION START: State for editing functionality ---
  const queryClient = useQueryClient();
  const [editingMessage, setEditingMessage] =
    useState<SimulationMessage | null>(null);
  const [editText, setEditText] = useState("");
  const [isConfirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  // --- MODIFICATION END ---

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [audioState, setAudioState] = useState<{
    playingId: string | null;
    isLoading: boolean;
  }>({ playingId: null, isLoading: false });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const targetChatId = chatId || currentChat?.id;

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["simulationMessages", targetChatId],
    queryFn: () => getSimulationMessagesByChat(targetChatId!),
    enabled: !!targetChatId,
  });

  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];
    if (classData?.classCode) {
      basePrompts.push(`Are you here for ${classData.classCode}?`);
      return [
        "Hi, how are you?",
        "What can I help you with?",
        `Are you here for ${classData.classCode}?`,
      ];
    }
    return basePrompts.slice(0, 3);
  }, [classData?.classCode]);

  const handleStarterPromptClick = (prompt: string) => sendMessage(prompt);
  const handleAudioModeToggle = () => {
    const newAudioMode = !assistantAudioEnabled;
    setAssistantAudioEnabled(newAudioMode);
    if (newAudioMode) testAndEnableAudio();
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
      // 1. Identify messages to delete
      const editTimestamp = new Date(editingMessage.updatedAt);
      const messagesToDelete = messages.filter(
        (msg) => new Date(msg.createdAt) > editTimestamp
      );

      // 2. Delete subsequent messages and their audio
      for (const msg of messagesToDelete) {
        if (msg.type === "response" && msg.audio) {
          await deleteAudio(msg.id);
        }
        await deleteSimulationMessage(msg.id);
      }

      // 3. Update the original message (set audio to false)
      await updateSimulationMessage(editingMessage.id, {
        content: editText,
        audio: false,
      });

      // 4. Invalidate query cache to refetch messages
      await queryClient.invalidateQueries({
        queryKey: ["simulationMessages", targetChatId],
      });

      // 5. Send the new message to get a new response
      sendMessage(editText);
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
  }, [messages.length]);

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
  }, [messages.length]);

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
            {/* ... (Existing Audio Mode UI) ... */}
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
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-primary text-primary-foreground rounded-lg p-3">
                                  {/* Edit button floated right, visible only on the LAST message */}
                                  {message.audio && !isSendingMessage && (
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
                                        <p>Edit & Resubmit</p>
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

                        {message.type === "response" &&
                          message.content !== "" && (
                            <div className="flex justify-start mb-3">
                              <div className="max-w-[80%]">
                                <div className="bg-muted rounded-lg p-3 relative">
                                  {/* The Markdown component comes first */}
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

                                  {/* Play button is now at the bottom right */}
                                  {message.audio && (
                                    <div className="absolute bottom-2 right-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                            onClick={() =>
                                              handlePlayPauseAudio(message)
                                            }
                                            disabled={
                                              audioState.isLoading &&
                                              audioState.playingId !==
                                                message.id
                                            }
                                          >
                                            {audioState.isLoading &&
                                            audioState.playingId ===
                                              message.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : audioState.playingId ===
                                              message.id ? (
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
                                  )}
                                </div>
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
              {isSubmittingEdit ? "Submitting..." : "Confirm & Resubmit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* --- MODIFICATION END --- */}
    </div>
  );
}
