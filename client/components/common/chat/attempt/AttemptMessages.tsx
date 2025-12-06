/**
 * AttemptMessages.tsx
 * Used to display the attempt messages. This will show the messages from the assistant, and the user. It will properly handle loading states, and will call as needed the above functions for context. It will eventually be able to play audio for each message and provide more custom streaming logic.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import {
  AlertCircle,
  ArrowDown,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { createFeedback } from "@/app/(main)/layout-server";
import HintDisplay from "@/components/common/chat/HintDisplay";
import Markdown from "@/components/common/chat/markdown/Markdown";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useProfile } from "@/contexts/profile-context";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { useRouter } from "next/navigation";

export interface AttemptMessagesProps {
  chatId?: string;
  isAttemptOwner?: boolean;
  messages: Array<{
    id: string;
    type: string;
    content: string;
    createdAt: string;
    completed?: boolean;
    personaId?: string;
  }>;
  currentChat: { id: string; completed?: boolean } | null;
  sendMessage: (message: string, isRetry?: boolean) => void;
  isSendingMessage: boolean;
  isActive: boolean;
  simulation: {
    timeLimit?: number | null;
    practiceSimulation?: boolean;
  } | null;
  currentChatHints?: Array<{
    messageId: string;
    hints: Array<{
      simulationMessageId: string;
      hint: string;
      idx: number;
      createdAt: string;
    }>;
  }>;
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;
  scenario?: {
    personaName?: string | null;
    personaIcon?: string | null;
    personaColor?: string | null;
  } | null;
}

// Utility function to generate gradient from hex color (same as PersonaPicker)
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export default function AttemptMessages({
  chatId,
  isAttemptOwner = true,
  messages: propMessages,
  currentChat,
  sendMessage,
  isSendingMessage,
  isActive,
  simulation,
  currentChatHints = [],
  personas,
  scenario: _scenario,
}: AttemptMessagesProps) {
  const { socket } = useProfile();
  const router = useRouter();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const targetChatId = chatId || currentChat?.id;

  // Create persona lookup map for efficient persona lookup by ID
  const personaMap = useMemo(() => {
    if (!personas)
      return new Map<
        string,
        { id: string; name: string; icon: string | null; color: string | null }
      >();
    return new Map(personas.map((p) => [p.id, p]));
  }, [personas]);

  // State for hints modal
  const [selectedHintMessageId, setSelectedHintMessageId] = useState<
    string | null
  >(null);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

  // State to track if report dialog is open
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // State to track streaming content for messages (messageId -> accumulatedContent)
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map()
  );

  // State to track optimistic messages from WebSocket events
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<
      string,
      {
        id: string;
        type: string; // "query" | "response"
        content: string;
        createdAt: string;
        completed: boolean;
        personaId?: string;
      }
    >
  >(new Map());

  // Get messages from props
  // Merge with optimistic messages and streaming content for real-time updates
  const messages = useMemo(() => {
    if (!propMessages) return Array.from(optimisticMessages.values());

    // Start with propMessages
    const messageMap = new Map<string, (typeof propMessages)[number]>();
    propMessages.forEach((msg) => messageMap.set(msg.id, msg));

    // Add optimistic messages not yet in propMessages
    optimisticMessages.forEach((optMsg, id) => {
      if (!messageMap.has(id)) {
        messageMap.set(id, optMsg);
      }
    });

    // Apply streaming content to all messages
    return Array.from(messageMap.values()).map((msg) => {
      const streaming = streamingContent.get(msg.id);
      if (
        streaming !== undefined &&
        (!msg.completed || streaming.length > msg.content.length)
      ) {
        return { ...msg, content: streaming };
      }
      return msg;
    });
  }, [propMessages, optimisticMessages, streamingContent]);

  // Sort messages chronologically (no grouping)
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];
    return basePrompts.slice(0, 3);
  }, []);

  const handleStarterPromptClick = (prompt: string) => {
    // Create optimistic user message immediately for instant feedback
    const tempId = `optimistic-user-${Date.now()}-${Math.random()}`;
    setOptimisticMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(tempId, {
        id: tempId,
        type: "query",
        content: prompt,
        createdAt: new Date().toISOString(),
        completed: true,
      });
      return newMap;
    });
    sendMessage(prompt);
  };

  const handleRetry = (errorMessageIndex: number) => {
    // Find the previous user message to retry with
    const sortedMessages = messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Find the previous user message (query type) that came before this error
    const previousUserMessage = sortedMessages
      .slice(0, errorMessageIndex)
      .reverse()
      .find((msg) => msg.type === "query");

    if (previousUserMessage) {
      // Retry with the previous user message content
      sendMessage(previousUserMessage.content, true);
    }
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

  // Clear streaming content and optimistic messages when chat changes
  useEffect(() => {
    setStreamingContent(new Map());
    setOptimisticMessages(new Map());
  }, [targetChatId]);

  // Clear streaming content for completed messages when SSR data refreshes
  // Also clear optimistic messages that are now in SSR data
  useEffect(() => {
    // Don't clear if propMessages is undefined or empty - might be during refresh
    if (!propMessages || propMessages.length === 0) return;

    // Clear streaming content for messages that are completed in SSR data
    setStreamingContent((prev) => {
      const newMap = new Map(prev);
      let changed = false;
      propMessages.forEach((msg) => {
        if (msg.completed && newMap.has(msg.id)) {
          // Only clear if SSR content matches or is longer (SSR has final content)
          const streaming = newMap.get(msg.id);
          if (streaming && msg.content.length >= streaming.length) {
            newMap.delete(msg.id);
            changed = true;
          }
        }
      });
      return changed ? newMap : prev;
    });

    // Clear optimistic messages that are now in SSR data
    // Only clear if the message actually exists in propMessages (not just because propMessages exists)
    setOptimisticMessages((prev) => {
      const newMap = new Map(prev);
      let changed = false;
      const propMessageIds = new Set(propMessages.map((msg) => msg.id));
      newMap.forEach((_msg, id) => {
        if (propMessageIds.has(id)) {
          newMap.delete(id);
          changed = true;
        }
      });
      return changed ? newMap : prev;
    });
  }, [targetChatId, propMessages]);

  // Listen for streaming token events to update message content in real-time
  useEffect(() => {
    if (!socket) return;

    const handleSimulationMessageToken = (data: {
      message_id: string;
      chat_id: string;
      token: string;
      accumulated_content: string;
    }) => {
      // Only update if this token is for the current chat
      if (
        data.chat_id === targetChatId &&
        data.accumulated_content !== undefined
      ) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.accumulated_content);
          return newMap;
        });
      }
    };

    // Listen for message completion - keep streaming content until SSR refresh completes
    // The streaming content will be cleared when SSR data is refreshed and has the final content
    const handleSimulationMessageComplete = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
    }) => {
      if (data.chat_id === targetChatId && data.final_content !== undefined) {
        // Update streaming content with final content to prevent flicker
        // This will be cleared when SSR data refreshes
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.final_content);
          return newMap;
        });
      }
    };

    const handleSimulationNewMessage = (data: {
      message_id: string;
      chat_id: string;
      role: string;
      content: string;
      completed: boolean;
      created_at: string;
      persona_id?: string;
    }) => {
      if (data.chat_id === targetChatId) {
        // Convert role to type (user -> query, assistant -> response)
        const type = data.role === "user" ? "query" : "response";
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);

          // For user messages, check if there's a matching optimistic message to replace
          if (type === "query") {
            const normalizedContent = data.content.trim().toLowerCase();

            // Find matching optimistic user message by content
            for (const [tempId, optMsg] of newMap.entries()) {
              if (
                optMsg.type === "query" &&
                tempId.startsWith("optimistic-user-") &&
                optMsg.content.trim().toLowerCase() === normalizedContent
              ) {
                // Replace temp message with real one (same content, real ID)
                newMap.delete(tempId);
                break;
              }
            }
          }

          // Add the real message (or new message if no match found)
          const optimisticMessage: {
            id: string;
            type: string;
            content: string;
            createdAt: string;
            completed: boolean;
            personaId?: string;
          } = {
            id: data.message_id,
            type,
            content: data.content,
            createdAt: data.created_at,
            completed: data.completed,
          };
          if (data.persona_id) {
            optimisticMessage.personaId = data.persona_id;
          }
          newMap.set(data.message_id, optimisticMessage);
          return newMap;
        });
      }
    };

    socket.on("simulation_message_token", handleSimulationMessageToken);
    socket.on("simulation_message_complete", handleSimulationMessageComplete);
    socket.on("simulation_new_message", handleSimulationNewMessage);

    return () => {
      socket.off("simulation_message_token", handleSimulationMessageToken);
      socket.off(
        "simulation_message_complete",
        handleSimulationMessageComplete
      );
      socket.off("simulation_new_message", handleSimulationNewMessage);
    };
  }, [socket, targetChatId]);

  // Listen for hint generation progress via WebSocket events
  useEffect(() => {
    if (!socket || !simulation?.practiceSimulation) {
      return;
    }

    const handleHintGenerationProgress = (data: {
      type: string;
      message: string;
      chat_id: string;
      message_id: string;
      hint_ids?: string[];
      hints_count?: number;
      hints?: Array<{ idx: number; hint: string }>;
      error?: string;
    }) => {
      // Only handle hints for the current chat
      if (data.chat_id === targetChatId && data.type === "complete") {
        // Add message_id to set of messages with new hints (for red dot indicator)
        setMessagesWithNewHints((prev) => {
          const newSet = new Set(prev);
          newSet.add(data.message_id);
          return newSet;
        });
        // Note: router.refresh() is handled in AttemptChat.tsx after a short delay
        // to allow database transaction to commit. The optimistic hints will show
        // immediately, and server hints will replace them once available.
        // Delay refresh slightly to ensure database transaction has committed
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    };

    socket.on("hint_generation_progress", handleHintGenerationProgress);

    return () => {
      socket.off("hint_generation_progress", handleHintGenerationProgress);
    };
  }, [socket, simulation?.practiceSimulation, targetChatId, router]);

  return (
    <div
      className="flex-1 flex flex-col p-0 min-h-0 relative"
      data-testid="attempt-messages-container"
    >
      <TooltipProvider>
        <>
          <ScrollArea className="flex-1 px-2 min-h-0" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6">
                  <>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Choose a prompt below or type your own message
                      </p>
                    </div>
                    <div
                      className="flex flex-col gap-3 w-full max-w-md"
                      data-testid="starter-prompts"
                    >
                      {starterPrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="h-auto p-4 text-left justify-start whitespace-normal"
                          onClick={() => handleStarterPromptClick(prompt)}
                          disabled={
                            currentChat?.completed ||
                            isSendingMessage ||
                            !isAttemptOwner
                          }
                        >
                          <span className="text-sm">{prompt}</span>
                        </Button>
                      ))}
                    </div>
                  </>
                </div>
              ) : (
                sortedMessages.map((message) => {
                  // Render user messages (query type)
                  if (message.type === "query") {
                    return (
                      <div key={message.id} className="flex justify-end mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          <div
                            className="bg-primary text-primary-foreground rounded-lg p-3 flex-1"
                            data-testid={`message-${message.id}`}
                            data-message-id={message.id}
                            data-message-type="user"
                          >
                            <Markdown>{message.content}</Markdown>
                          </div>
                          {/* Right-aligned controls */}
                          <div className="flex flex-col gap-1 w-9 h-[52px] min-h-[52px] max-h-[52px] overflow-hidden">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  aria-label="You"
                                  className="flex-1 p-0 rounded-md"
                                  tabIndex={-1}
                                >
                                  <User className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>You</p>
                              </TooltipContent>
                            </Tooltip>
                            <div className="flex-1" />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render assistant messages (response type)
                  if (message.type === "response") {
                    const hintsForMessage =
                      currentChatHints.find((h) => h.messageId === message.id)
                        ?.hints || [];
                    const shouldShowHintsButton =
                      simulation?.practiceSimulation &&
                      hintsForMessage.length > 0;
                    const containerHeightClass = shouldShowHintsButton
                      ? "h-[52px] min-h-[52px] max-h-[52px]"
                      : "h-[26px] min-h-[26px] max-h-[26px]";
                    const hasNewHints = messagesWithNewHints.has(message.id);
                    const isSelected = selectedHintMessageId === message.id;

                    // Get persona data from message's personaId, fallback to default
                    const messagePersona = message.personaId
                      ? personaMap.get(message.personaId)
                      : null;
                    const personaName = messagePersona?.name || "Assistant";
                    const personaIcon = messagePersona?.icon;
                    const personaColor = messagePersona?.color;

                    // Get icon component
                    const IconComponent = personaIcon
                      ? getPersonaIconComponent(personaIcon) || MessageSquare
                      : MessageSquare;

                    // Generate gradient style if persona color is available
                    const buttonStyle = personaColor
                      ? {
                          background: generateGradientFromHex(personaColor),
                        }
                      : undefined;

                    return (
                      <div key={message.id} className="flex justify-start mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          {/* Left-aligned stacked controls (assistant + optional hints) */}
                          <div
                            className={`flex flex-col gap-1 w-9 ${containerHeightClass} overflow-visible`}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  aria-label={personaName}
                                  className="flex-1 p-0 rounded-md"
                                  style={buttonStyle}
                                  tabIndex={-1}
                                >
                                  <IconComponent className="h-4 w-4 text-white" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{personaName}</p>
                              </TooltipContent>
                            </Tooltip>
                            {shouldShowHintsButton ? (
                              <Popover
                                open={isSelected}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setSelectedHintMessageId(message.id);
                                    if (hasNewHints) {
                                      setMessagesWithNewHints((prev) => {
                                        const newSet = new Set(prev);
                                        newSet.delete(message.id);
                                        return newSet;
                                      });
                                    }
                                  } else {
                                    setSelectedHintMessageId(null);
                                  }
                                }}
                                modal={false}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={
                                          isSelected ? "default" : "outline"
                                        }
                                        size="sm"
                                        aria-label="Show hints"
                                        className="flex-1 p-0 rounded-md relative overflow-visible"
                                      >
                                        <Lightbulb className="h-4 w-4" />
                                        {hasNewHints && (
                                          <span className="absolute -top-1 -right-1 bg-red-500 rounded-full w-3 h-3 border-2 border-white shadow-sm z-10" />
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Show hints</p>
                                  </TooltipContent>
                                </Tooltip>
                                <PopoverContent
                                  className="w-96 p-4"
                                  align="start"
                                  side="top"
                                  sideOffset={35}
                                >
                                  <HintDisplay
                                    hints={hintsForMessage}
                                    onClose={() =>
                                      setSelectedHintMessageId(null)
                                    }
                                  />
                                </PopoverContent>
                              </Popover>
                            ) : null}
                          </div>
                          <div className="relative group p-2 -m-2 flex-1">
                            {/* Show loading state for empty/incomplete messages, otherwise show content */}
                            {!message.completed && message.content === "" ? (
                              <div
                                className="bg-muted rounded-lg p-3"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <div className="flex items-center">
                                  <LoadingDots />
                                </div>
                              </div>
                            ) : message.completed && message.content === "" ? (
                              // Show "No response" for completed messages with empty content
                              <div
                                className="bg-muted rounded-lg p-3"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <span className="text-gray-500 italic">
                                  No response
                                </span>
                              </div>
                            ) : message.completed &&
                              message.content.startsWith("Error:") ? (
                              // Show error messages in red with retry button
                              <div
                                className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 relative"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <div className="text-destructive pr-12">
                                  <Markdown>{message.content}</Markdown>
                                </div>
                                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                  {/* Report Error Button */}
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <ReportProblem
                                        createFeedback={createFeedback}
                                        initialType="bug"
                                        initialMessage={`Error in simulation chat: ${message.content}\n\nChat ID: ${targetChatId}\nMessage ID: ${message.id}`}
                                        onDialogStateChange={
                                          setIsReportDialogOpen
                                        }
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0"
                                        >
                                          <AlertCircle className="h-4 w-4" />
                                        </Button>
                                      </ReportProblem>
                                    </TooltipTrigger>
                                    {!isReportDialogOpen && (
                                      <TooltipContent>
                                        <p>Report this error</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>

                                  {/* Retry Button */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleRetry(
                                            sortedMessages.indexOf(message)
                                          )
                                        }
                                        className="h-8 w-8 p-0"
                                        disabled={
                                          currentChat?.completed ||
                                          isSendingMessage ||
                                          (simulation?.timeLimit
                                            ? !isActive
                                            : false)
                                        }
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Retry this message</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="bg-muted rounded-lg p-3 relative"
                                data-testid={`message-${message.id}`}
                                data-message-id={message.id}
                                data-message-type="assistant"
                              >
                                <Markdown>{message.content}</Markdown>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
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
      </TooltipProvider>
    </div>
  );
}
