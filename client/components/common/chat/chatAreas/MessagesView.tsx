/**
 * MessagesView.tsx
 * Unified messages display for both active and graded modes.
 * Uses OpenAPI types directly - no manual type definitions.
 */
"use client";

import { createFeedback } from "@/app/(main)/layout-server";
import HintDisplay from "@/components/common/chat/HintDisplay";
import Markdown from "@/components/common/chat/markdown/Markdown";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import {
  AlertCircle,
  ArrowDown,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageContentAdapter } from "../generic/utils/MessageContentAdapter";

// ---- OpenAPI types (single source of truth) ----
type MessageData = components["schemas"]["MessageData"];
type ContentEntry = components["schemas"]["ContentEntry"];
type FeedbackEntry = components["schemas"]["MessageFeedbackEntry"];

// Props interface using OpenAPI types
export interface MessagesViewProps {
  messages?: MessageData[];
  streaming_content?: Map<string, string>;
  optimistic_messages?: Map<string, MessageData>;
  current_chat?: { id: string; completed?: boolean | null } | null;
  new_hint_message_ids?: Array<string>;
  send_message: (message: string) => void;
  retry_message?: (message_id: string) => void;
  is_sending_message: boolean;
  is_active: boolean; // Used for future features
  background_image?: string | null;
  disabled?: boolean;
  is_attempt_owner?: boolean;
  chat_id?: string;
}

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Utility function to normalize message content for comparison
const normalizeMessageContent = (content: string): string => {
  return content.trim().toLowerCase();
};

// Component to display feedback (strength or improvement) with hover support
function FeedbackDisplay({
  feedback,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  feedback: FeedbackEntry | null;
  isHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}) {
  if (!feedback) return null;
  const isStrength = feedback.type === "strength";
  return (
    <div
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={cn(
        "rounded-lg border-2 p-3 transition-colors duration-200 cursor-pointer",
        isStrength
          ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        isHovered && isStrength && "border-green-500 bg-green-500/20",
        isHovered && !isStrength && "border-amber-500 bg-amber-500/20"
      )}
    >
      <div className="text-sm font-semibold mb-1">{feedback.name}</div>
      <div className="text-sm">{feedback.description}</div>
    </div>
  );
}

export function MessagesView({
  messages: propMessages,
  streaming_content = new Map(),
  optimistic_messages = new Map(),
  current_chat,
  new_hint_message_ids,
  send_message,
  retry_message,
  is_sending_message,
  is_active,
  background_image,
  disabled = false,
  is_attempt_owner = true,
  chat_id,
}: MessagesViewProps) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const targetChatId = chat_id || current_chat?.id;

  // State for hints modal
  const [selectedHintMessageId, setSelectedHintMessageId] = useState<
    string | null
  >(null);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

  // State for feedback hover - shows annotations in message when hovering feedback card
  const [hoveredFeedbackId, setHoveredFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!new_hint_message_ids) return;
    setMessagesWithNewHints(new Set(new_hint_message_ids));
  }, [new_hint_message_ids]);

  // Helper to get first content text from a message
  const getFirstContentText = (msg: { contents?: ContentEntry[] | null }): string => {
    return msg.contents?.[0]?.content || "";
  };

  // Merge messages from props with optimistic messages and streaming content
  const messages = useMemo(() => {
    if (!propMessages) return Array.from(optimistic_messages.values());

    const messageMap = new Map<string, (typeof propMessages)[number]>();
    propMessages.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });

    // Add optimistic messages
    optimistic_messages.forEach((optMsg, id) => {
      if (!messageMap.has(id)) {
        messageMap.set(id, optMsg);
      }
    });

    // Apply streaming content to first content entry
    const messagesWithStreaming = Array.from(messageMap.values()).map((msg) => {
      const streaming = streaming_content.get(msg.id);
      const firstContentText = getFirstContentText(msg);
      if (
        streaming !== undefined &&
        (!msg.completed || streaming.length > firstContentText.length)
      ) {
        // Update first content entry with streaming content
        const updatedContents = msg.contents ? [...msg.contents] : [{ content: "" }];
        if (updatedContents.length > 0) {
          updatedContents[0] = { ...updatedContents[0], content: streaming };
        } else {
          updatedContents.push({ content: streaming });
        }
        return { ...msg, contents: updatedContents };
      }
      return msg;
    });

    // Deduplicate user messages by first content text
    const deduplicatedMessages: typeof messagesWithStreaming = [];
    const seenContent = new Map<string, string>();

    for (const msg of messagesWithStreaming) {
      if (msg.type === "query") {
        const normalizedContent = normalizeMessageContent(getFirstContentText(msg));
        const existingMessageId = seenContent.get(normalizedContent);

        if (existingMessageId) {
          const isCurrentOptimistic = msg.id.startsWith("optimistic-user-");
          const isExistingOptimistic =
            existingMessageId.startsWith("optimistic-user-");

          if (isCurrentOptimistic && !isExistingOptimistic) {
            continue;
          } else if (!isCurrentOptimistic && isExistingOptimistic) {
            const existingIndex = deduplicatedMessages.findIndex(
              (m) => m.id === existingMessageId
            );
            if (existingIndex !== -1) {
              deduplicatedMessages[existingIndex] = msg;
              seenContent.set(normalizedContent, msg.id);
            }
            continue;
          } else {
            const currentIsFromProps = propMessages.some(
              (m) => m.id === msg.id
            );
            const existingIsFromProps = propMessages.some(
              (m) => m.id === existingMessageId
            );

            if (currentIsFromProps && !existingIsFromProps) {
              const existingIndex = deduplicatedMessages.findIndex(
                (m) => m.id === existingMessageId
              );
              if (existingIndex !== -1) {
                deduplicatedMessages[existingIndex] = msg;
                seenContent.set(normalizedContent, msg.id);
              }
              continue;
            } else {
              continue;
            }
          }
        } else {
          seenContent.set(normalizedContent, msg.id);
          deduplicatedMessages.push(msg);
        }
      } else {
        deduplicatedMessages.push(msg);
      }
    }

    return deduplicatedMessages;
  }, [propMessages, optimistic_messages, streaming_content]);

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages]);

  const starterPrompts = useMemo(() => {
    return [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ].slice(0, 3);
  }, []);

  const handleStarterPromptClick = (prompt: string) => {
    const tempId = `optimistic-user-${Date.now()}-${Math.random()}`;
    // Note: In real implementation, this would update optimistic_messages via callback
    send_message(prompt);
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
    const currentChatId = targetChatId ?? null;
    if (
      prevChatIdRef.current !== null &&
      prevChatIdRef.current !== currentChatId
    ) {
      // Chat changed - clear state (handled by parent via props)
    }
    prevChatIdRef.current = currentChatId;
  }, [targetChatId]);

  // Determine background image style
  const backgroundImageUrl = background_image
    ? `/api/uploads/download/${background_image}`
    : null;
  const backgroundStyle = backgroundImageUrl
    ? {
        "--bg-image-url": `url('${backgroundImageUrl}')`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
        backgroundRepeat: "no-repeat" as const,
      }
    : undefined;

  return (
    <div
      className={`flex-1 flex flex-col p-0 min-h-0 relative ${backgroundImageUrl ? "attempt-messages-background" : ""}`}
      data-testid="attempt-messages-container"
      style={backgroundStyle}
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
                            current_chat?.completed ||
                            is_sending_message ||
                            !is_attempt_owner ||
                            disabled
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
                  // Get contents array (or empty if none)
                  const contents = message.contents || [];
                  const isQuery = message.type === "query";
                  const isOptimisticVoiceMessage =
                    message.id.startsWith("optimistic-user-voice-") &&
                    contents.length === 0;

                  // Hints directly on message (shown if present)
                  const hints = message.hints || [];
                  const hasHints = hints.length > 0;
                  const hasNewHints = messagesWithNewHints.has(message.id);
                  const isHintSelected = selectedHintMessageId === message.id;

                  // Feedbacks for graded messages
                  const feedbacks = message.feedbacks || [];
                  const hasFeedbacks = feedbacks.length > 0;

                  // Handle empty/loading states at message level
                  if (contents.length === 0) {
                    if (isOptimisticVoiceMessage) {
                      // Voice message being transcribed
                      return (
                        <div key={message.id} className="flex justify-end mb-3">
                          <div className="max-w-[80%]">
                            <div className="bg-primary text-primary-foreground rounded-lg p-3 flex items-center justify-center">
                              <LoadingDots />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (!message.completed) {
                      // Streaming response not yet started
                      return (
                        <div key={message.id} className="flex justify-start mb-3">
                          <div className="max-w-[80%]">
                            <div className="bg-muted rounded-lg p-3 flex items-center justify-center">
                              <LoadingDots />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // Completed but empty
                    return (
                      <div key={message.id} className={`flex ${isQuery ? "justify-end" : "justify-start"} mb-3`}>
                        <div className="max-w-[80%]">
                          <div className="bg-muted rounded-lg p-3">
                            <span className="text-gray-500 italic">No content</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render each content entry with its own display info
                  return (
                    <div key={message.id} className="space-y-2 mb-3">
                      {contents.map((contentEntry: ContentEntry, contentIndex: number) => {
                        const displayName = contentEntry.name || (isQuery ? "You" : "Assistant");
                        const displayColor = contentEntry.color;
                        const displayIcon = contentEntry.icon;
                        const contentText = contentEntry.content || "";

                        // Get icon component
                        const IconComponent = displayIcon
                          ? getPersonaIconComponent(displayIcon) || (isQuery ? User : MessageSquare)
                          : isQuery ? User : MessageSquare;

                        // Generate gradient style if color is available
                        const buttonStyle = displayColor
                          ? { background: generateGradientFromHex(displayColor) }
                          : undefined;

                        // Show hints button on last content entry of response messages
                        const isLastContent = contentIndex === contents.length - 1;
                        const showHintsButton = !isQuery && isLastContent && hasHints;
                        const containerHeightClass = showHintsButton
                          ? "h-[52px] min-h-[52px] max-h-[52px]"
                          : "h-[26px] min-h-[26px] max-h-[26px]";

                        // Check for error content
                        const isError = message.completed && contentText.startsWith("Error:");

                        if (isQuery) {
                          // User message - right aligned
                          return (
                            <div key={`${message.id}-${contentIndex}`} className="flex flex-col items-end gap-2">
                              {/* Show feedbacks above message (only on first content) */}
                              {contentIndex === 0 && hasFeedbacks && (
                                <div className="max-w-[90%] space-y-2">
                                  {feedbacks.map((fb: FeedbackEntry) => (
                                    <FeedbackDisplay
                                      key={fb.id}
                                      feedback={fb}
                                      isHovered={hoveredFeedbackId === fb.id}
                                      onHoverStart={() => setHoveredFeedbackId(fb.id)}
                                      onHoverEnd={() => setHoveredFeedbackId(null)}
                                    />
                                  ))}
                                </div>
                              )}
                              <div className="flex items-stretch gap-2 max-w-[80%]">
                                <div
                                  className="bg-primary text-primary-foreground rounded-lg p-3"
                                  data-testid={`message-${message.id}-content-${contentIndex}`}
                                  data-message-type="user"
                                >
                                    {hasFeedbacks ? (
                                      <MessageContentAdapter
                                        content={contentText}
                                        feedbacks={feedbacks}
                                        hoveredFeedbackId={hoveredFeedbackId}
                                      />
                                    ) : (
                                      <Markdown>{contentText}</Markdown>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-hidden">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        aria-label={displayName}
                                        className="flex-1 p-0 rounded-md"
                                        style={buttonStyle}
                                        tabIndex={-1}
                                      >
                                        <IconComponent className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{displayName}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Assistant message - left aligned
                        return (
                          <div key={`${message.id}-${contentIndex}`} className="flex flex-col items-start gap-2">
                            {/* Show feedbacks above message (only on first content) - wider */}
                            {contentIndex === 0 && hasFeedbacks && (
                              <div className="max-w-[90%] space-y-2">
                                {feedbacks.map((fb: FeedbackEntry) => (
                                  <FeedbackDisplay
                                    key={fb.id}
                                    feedback={fb}
                                    isHovered={hoveredFeedbackId === fb.id}
                                    onHoverStart={() => setHoveredFeedbackId(fb.id)}
                                    onHoverEnd={() => setHoveredFeedbackId(null)}
                                  />
                                ))}
                              </div>
                            )}
                            <div className="max-w-[80%] flex items-stretch gap-2">
                                {/* Left-aligned stacked controls */}
                                <div className={`flex flex-col gap-1 w-9 ${containerHeightClass} overflow-visible`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        aria-label={displayName}
                                        className="flex-1 p-0 rounded-md"
                                        style={buttonStyle}
                                        tabIndex={-1}
                                      >
                                        <IconComponent className="h-4 w-4 text-white" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{displayName}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {showHintsButton && (
                                    <Popover
                                      open={isHintSelected}
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
                                              variant={isHintSelected ? "default" : "outline"}
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
                                          hints={hints}
                                          onClose={() => setSelectedHintMessageId(null)}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                                <div className="relative group p-2 -m-2 flex-1">
                                  {isError ? (
                                    <div
                                      className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 relative"
                                      data-testid={`message-${message.id}-content-${contentIndex}`}
                                      data-message-type="assistant"
                                    >
                                      <div className="text-destructive pr-12">
                                        <Markdown>{contentText}</Markdown>
                                      </div>
                                      <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <ReportProblem
                                              createFeedback={createFeedback}
                                              initialType="bug"
                                              initialMessage={`Error in simulation chat: ${contentText}\n\nChat ID: ${targetChatId}\nMessage ID: ${message.id}`}
                                            >
                                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                                <AlertCircle className="h-4 w-4" />
                                              </Button>
                                            </ReportProblem>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Report this error</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => retry_message?.(message.id)}
                                              className="h-8 w-8 p-0"
                                              disabled={!retry_message || current_chat?.completed || is_sending_message || disabled}
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
                                      className="bg-muted rounded-lg p-3"
                                      data-testid={`message-${message.id}-content-${contentIndex}`}
                                      data-message-type="assistant"
                                    >
                                      {hasFeedbacks ? (
                                        <MessageContentAdapter
                                          content={contentText}
                                          feedbacks={feedbacks}
                                          hoveredFeedbackId={hoveredFeedbackId}
                                        />
                                      ) : (
                                        <Markdown>{contentText}</Markdown>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
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
