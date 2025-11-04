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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

import Markdown from "@/components/common/chat/markdown/Markdown";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";
import { AttemptFullResponse } from "@/lib/api/v2/schemas/attempts";

export interface AttemptMessagesProps {
  chatId?: string;
  isAttemptOwner?: boolean;
}

export default function AttemptMessages({
  chatId,
  isAttemptOwner = true,
}: AttemptMessagesProps) {
  const simulationContext = useSimulation();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const targetChatId = chatId || simulationContext?.currentChat?.id;

  // State to track which response version is shown for each message group
  const [responseVersions, setResponseVersions] = useState<
    Record<string, number>
  >({});

  // State to track if report dialog is open
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // Get messages from context for the specific chat (not just currentMessages)
  const messages = useMemo(() => {
    if (!targetChatId || !simulationContext?.attemptData?.chats) return [];
    const chatData = simulationContext.attemptData.chats.find(
      (c) => c.chat.id === targetChatId
    );
    return chatData?.messages || [];
  }, [targetChatId, simulationContext?.attemptData]);
  const messagesLoading = simulationContext?.isLoadingChats || false;

  // Group messages by conversation turns (user message + all its responses)
  const groupedMessages = useMemo(() => {
    const sortedMessages = messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const groups: Array<{
      userMessage: AttemptFullResponse["chats"][number]["messages"][number];
      responses: AttemptFullResponse["chats"][number]["messages"];
      groupId: string;
    }> = [];

    let currentUserMessage:
      | AttemptFullResponse["chats"][number]["messages"][number]
      | null = null;
    let currentResponses: AttemptFullResponse["chats"][number]["messages"] = [];

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
    // Dispatch messageSent event for tour progression and navigating state management
    window.dispatchEvent(
      new CustomEvent("messageSent", {
        detail: {
          message: prompt,
          chatId: targetChatId,
          isTourMessage: false,
        },
      })
    );
    simulationContext?.sendMessage(prompt);
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
      window.dispatchEvent(
        new CustomEvent("messageSent", {
          detail: {
            message: previousUserMessage.content,
            chatId: targetChatId,
            isTourMessage: false,
          },
        })
      );
      simulationContext?.sendMessage(previousUserMessage.content, true);
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
        <>
          <ScrollArea className="flex-1 px-4 min-h-0" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6">
                  <>
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
                      <div className="max-w-[80%]">
                        <div className="bg-primary text-primary-foreground rounded-lg p-3">
                          <Markdown>{group.userMessage.content}</Markdown>
                        </div>
                      </div>
                    </div>

                    {/* Assistant response(s) */}
                    {group.responses.length > 0 && (
                      <div className="flex justify-start mb-3">
                        <div className="max-w-[80%] relative group p-2 -m-2">
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
                                  <div className="bg-muted rounded-lg p-3">
                                    <div className="flex items-center">
                                      <LoadingDots />
                                    </div>
                                  </div>
                                ) : currentResponse.completed &&
                                  currentResponse.content === "" ? (
                                  // Show "No response" for completed messages with empty content
                                  <div className="bg-muted rounded-lg p-3">
                                    <span className="text-gray-500 italic">
                                      No response
                                    </span>
                                  </div>
                                ) : currentResponse.completed &&
                                  currentResponse.content.startsWith(
                                    "Error:"
                                  ) ? (
                                  // Show error messages in red with retry button (only if no successful responses exist)
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 relative">
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
                                                    simulationContext
                                                      ?.currentChat
                                                      ?.completed ||
                                                    simulationContext?.isSendingMessage ||
                                                    (simulationContext
                                                      ?.simulation?.timeLimit
                                                      ? !simulationContext?.isActive
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
                                  <div className="bg-muted rounded-lg p-3 relative">
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
