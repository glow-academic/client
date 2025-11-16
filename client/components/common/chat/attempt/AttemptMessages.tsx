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
  ArrowRight,
  ChevronLeft,
  ChevronRight,
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
  scenario,
}: AttemptMessagesProps) {
  const { socket } = useProfile();
  const router = useRouter();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const targetChatId = chatId || currentChat?.id;

  // State for hints modal
  const [selectedHintMessageId, setSelectedHintMessageId] = useState<
    string | null
  >(null);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

  // State to track which response version is shown for each message group
  const [responseVersions, setResponseVersions] = useState<
    Record<string, number>
  >({});

  // State to track if report dialog is open
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // State to track streaming content for messages (messageId -> accumulatedContent)
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map()
  );

  // Get messages from props
  // Merge with streaming content for real-time updates
  const messages = useMemo(() => {
    if (!propMessages) return [];

    // Merge streaming content with SSR messages
    // Only use streaming content if message is not completed (still streaming)
    // or if streaming content is more recent than SSR content
    return propMessages.map((msg) => {
      const streaming = streamingContent.get(msg.id);
      if (
        streaming !== undefined &&
        (!msg.completed || streaming.length > msg.content.length)
      ) {
        return {
          ...msg,
          content: streaming,
        };
      }
      return msg;
    });
  }, [propMessages, streamingContent]);

  // Group messages by conversation turns (user message + all its responses)
  const groupedMessages = useMemo(() => {
    const sortedMessages = messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    type Message = {
      id: string;
      type: string;
      content: string;
      createdAt: string;
      completed?: boolean;
    };

    const groups: Array<{
      userMessage: Message;
      responses: Message[];
      groupId: string;
    }> = [];

    let currentUserMessage: Message | null = null;
    let currentResponses: Message[] = [];

    for (const message of sortedMessages) {
      if (message.type === "query") {
        // If we have a previous user message, save the group
        if (currentUserMessage) {
          groups.push({
            userMessage: currentUserMessage,
            responses: currentResponses,
            groupId: currentUserMessage.id,
          });
        }
        // Start new group
        currentUserMessage = message;
        currentResponses = [];
      } else if (message.type === "response" && currentUserMessage) {
        currentResponses.push(message);
      }
    }

    // Add the last group
    if (currentUserMessage) {
      groups.push({
        userMessage: currentUserMessage,
        responses: currentResponses,
        groupId: currentUserMessage.id,
      });
    }

    return groups;
  }, [messages]);

  // Initialize response versions for new groups (default to latest)
  useEffect(() => {
    const newVersions: Record<string, number> = {};
    groupedMessages.forEach((group) => {
      if (group.responses.length > 0 && !(group.groupId in responseVersions)) {
        newVersions[group.groupId] = group.responses.length - 1; // Default to latest (index 0-based)
      }
    });

    if (Object.keys(newVersions).length > 0) {
      setResponseVersions((prev) => ({ ...prev, ...newVersions }));
    }
  }, [groupedMessages, responseVersions]);

  const handleResponseNavigation = (
    groupId: string,
    direction: "prev" | "next"
  ) => {
    const group = groupedMessages.find((g) => g.groupId === groupId);
    if (!group || group.responses.length <= 1) return;

    const currentIndex =
      responseVersions[groupId] ?? group.responses.length - 1;
    let newIndex = currentIndex;

    if (direction === "prev" && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (
      direction === "next" &&
      currentIndex < group.responses.length - 1
    ) {
      newIndex = currentIndex + 1;
    }

    setResponseVersions((prev) => ({ ...prev, [groupId]: newIndex }));
  };

  const getCurrentResponse = (groupId: string) => {
    const group = groupedMessages.find((g) => g.groupId === groupId);
    if (!group || group.responses.length === 0) return null;

    const currentIndex =
      responseVersions[groupId] ?? group.responses.length - 1;
    return group.responses[currentIndex];
  };

  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];
    return basePrompts.slice(0, 3);
  }, []);

  const handleStarterPromptClick = (prompt: string) => {
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
      // Find the group that contains this error message
      const errorMessage = sortedMessages[errorMessageIndex];
      if (errorMessage) {
        const group = groupedMessages.find((g) =>
          g.responses.some((r) => r.id === errorMessage.id)
        );

        if (group) {
          // Set the response version to the latest (where the new response will appear)
          setResponseVersions((prev) => ({
            ...prev,
            [group.groupId]: group.responses.length,
          }));
        }
      }

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

  // Clear streaming content when chat changes
  useEffect(() => {
    setStreamingContent(new Map());
  }, [targetChatId]);

  // Clear streaming content for completed messages when SSR data refreshes
  useEffect(() => {
    if (!propMessages) return;

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

    socket.on("simulation_message_token", handleSimulationMessageToken);
    socket.on("simulation_message_complete", handleSimulationMessageComplete);

    return () => {
      socket.off("simulation_message_token", handleSimulationMessageToken);
      socket.off(
        "simulation_message_complete",
        handleSimulationMessageComplete
      );
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
                groupedMessages.map((group) => (
                  <div key={group.groupId} className="space-y-3">
                    {/* User message */}
                    <div className="flex justify-end mb-3">
                      <div className="max-w-[80%] flex items-stretch gap-2">
                        <div
                          className="bg-primary text-primary-foreground rounded-lg p-3 flex-1"
                          data-testid={`message-${group.userMessage.id}`}
                          data-message-id={group.userMessage.id}
                          data-message-type="user"
                        >
                          <Markdown>{group.userMessage.content}</Markdown>
                        </div>
                        {/* Right-aligned stacked controls (You + Next) */}
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
                          {/* Temporarily hide Next button while preserving height of 'You' button. We will add this back later when we support branching of messages. */}
                          {false && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label="Next"
                                  className="flex-1 p-0 rounded-md"
                                  tabIndex={-1}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Next</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <div className="flex-1" />
                        </div>
                      </div>
                    </div>

                    {/* Assistant response(s) */}
                    {group.responses.length > 0 && (
                      <div className="flex justify-start mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          {/* Left-aligned stacked controls (assistant + optional hints) */}
                          {(() => {
                            const currentResponse = getCurrentResponse(
                              group.groupId
                            );
                            if (!currentResponse) return null;

                            const hintsForMessage =
                              currentChatHints.find(
                                (h) => h.messageId === currentResponse.id
                              )?.hints || [];
                            const shouldShowHintsButton =
                              simulation?.practiceSimulation &&
                              hintsForMessage.length > 0;
                            const containerHeightClass = shouldShowHintsButton
                              ? "h-[52px] min-h-[52px] max-h-[52px]"
                              : "h-[26px] min-h-[26px] max-h-[26px]";
                            const hasNewHints = messagesWithNewHints.has(
                              currentResponse.id
                            );
                            const isSelected =
                              selectedHintMessageId === currentResponse.id;

                            // Get persona data from scenario
                            const personaName =
                              scenario?.personaName || "Assistant";
                            const personaIcon = scenario?.personaIcon;
                            const personaColor = scenario?.personaColor;

                            // Get icon component - use persona icon if available, otherwise default to MessageSquare
                            const IconComponent = personaIcon
                              ? getPersonaIconComponent(personaIcon) ||
                                MessageSquare
                              : MessageSquare;

                            // Generate gradient style if persona color is available
                            const buttonStyle = personaColor
                              ? {
                                  background:
                                    generateGradientFromHex(personaColor),
                                }
                              : undefined;

                            return (
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
                                        setSelectedHintMessageId(
                                          currentResponse.id
                                        );
                                        // Clear new hints indicator when opening popover
                                        if (hasNewHints) {
                                          setMessagesWithNewHints((prev) => {
                                            const newSet = new Set(prev);
                                            newSet.delete(currentResponse.id);
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
                            );
                          })()}
                          <div className="relative group p-2 -m-2 flex-1">
                            {(() => {
                              const currentResponse = getCurrentResponse(
                                group.groupId
                              );
                              if (!currentResponse) return null;

                              return (
                                <>
                                  {/* Show loading state for empty/incomplete messages, otherwise show content */}
                                  {!currentResponse.completed &&
                                  currentResponse.content === "" ? (
                                    <div
                                      className="bg-muted rounded-lg p-3"
                                      data-testid={`message-${currentResponse.id}`}
                                      data-message-id={currentResponse.id}
                                      data-message-type="assistant"
                                    >
                                      <div className="flex items-center">
                                        <LoadingDots />
                                      </div>
                                    </div>
                                  ) : currentResponse.completed &&
                                    currentResponse.content === "" ? (
                                    // Show "No response" for completed messages with empty content
                                    <div
                                      className="bg-muted rounded-lg p-3"
                                      data-testid={`message-${currentResponse.id}`}
                                      data-message-id={currentResponse.id}
                                      data-message-type="assistant"
                                    >
                                      <span className="text-gray-500 italic">
                                        No response
                                      </span>
                                    </div>
                                  ) : currentResponse.completed &&
                                    currentResponse.content.startsWith(
                                      "Error:"
                                    ) ? (
                                    // Show error messages in red with retry button (only if no successful responses exist)
                                    <div
                                      className="bg-red-50 border border-red-200 rounded-lg p-3 relative"
                                      data-testid={`message-${currentResponse.id}`}
                                      data-message-id={currentResponse.id}
                                      data-message-type="assistant"
                                    >
                                      <div className="text-red-700 pr-12">
                                        <Markdown>
                                          {currentResponse.content}
                                        </Markdown>
                                      </div>
                                      {(() => {
                                        // Check if there are any non-error responses in this group
                                        const hasSuccessfulResponse =
                                          group.responses.some(
                                            (response) =>
                                              response.completed &&
                                              !response.content.startsWith(
                                                "Error:"
                                              )
                                          );

                                        return (
                                          <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                            {/* Report Error Button - Always shown for error messages */}
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <ReportProblem
                                                  createFeedback={
                                                    createFeedback
                                                  }
                                                  initialType="bug"
                                                  initialMessage={`Error in simulation chat: ${currentResponse.content}\n\nChat ID: ${targetChatId}\nMessage ID: ${currentResponse.id}`}
                                                  onDialogStateChange={
                                                    setIsReportDialogOpen
                                                  }
                                                >
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 border border-red-200 rounded-md"
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

                                            {/* Retry Button - Only shown if no successful responses exist */}
                                            {!hasSuccessfulResponse && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      handleRetry(
                                                        messages.indexOf(
                                                          currentResponse
                                                        )
                                                      )
                                                    }
                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 border border-red-200 rounded-md"
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
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <div
                                      className="bg-muted rounded-lg p-3 relative"
                                      data-testid={`message-${currentResponse.id}`}
                                      data-message-id={currentResponse.id}
                                      data-message-type="assistant"
                                    >
                                      <Markdown>
                                        {currentResponse.content}
                                      </Markdown>
                                    </div>
                                  )}

                                  {/* Response navigation and rating (right) - add a row only when chevrons exist */}
                                  {group.responses.length > 1 && (
                                    <div className="flex items-center justify-between gap-0 mt-1">
                                      {/* Thumbs rating (left side) - show on hover */}

                                      {/* Response navigation (right side) - always visible */}
                                      <div className="flex items-center gap-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleResponseNavigation(
                                              group.groupId,
                                              "prev"
                                            )
                                          }
                                          disabled={
                                            (responseVersions[group.groupId] ??
                                              group.responses.length - 1) === 0
                                          }
                                          className="h-6 w-6 p-0"
                                        >
                                          <ChevronLeft className="h-3 w-3" />
                                        </Button>
                                        <span className="text-xs text-muted-foreground px-1">
                                          {(responseVersions[group.groupId] ??
                                            group.responses.length - 1) + 1}
                                          /{group.responses.length}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleResponseNavigation(
                                              group.groupId,
                                              "next"
                                            )
                                          }
                                          disabled={
                                            (responseVersions[group.groupId] ??
                                              group.responses.length - 1) ===
                                            group.responses.length - 1
                                          }
                                          className="h-6 w-6 p-0"
                                        >
                                          <ChevronRight className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
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
      </TooltipProvider>
    </div>
  );
}
