/**
 * MessagesView.tsx
 * Normal messages display (active mode)
 * Explicit, self-contained types (like resource components)
 * Extracted from AttemptMessages.tsx
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
import { getPersonaIconComponent } from "@/utils/persona-icons";
import {
  AlertCircle,
  ArrowDown,
  Lightbulb,
  MessageSquare,
  RotateCcw,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

// Explicit, self-contained prop interface (like resource components)
export interface MessagesViewProps {
  // Explicit message type - self-contained, no external dependencies
  messages?: Array<{
    id: string;
    type: "query" | "response";
    content: string;
    created_at: string;
    completed?: boolean | null;
    persona_id?: string | null;
  }>;

  // Explicit streaming content type
  streaming_content?: Map<string, string>;

  // Explicit optimistic messages type
  optimistic_messages?: Map<
    string,
    {
      id: string;
      type: "query" | "response";
      content: string;
      created_at: string;
      completed: boolean;
      persona_id?: string | null;
    }
  >;

  // Explicit persona type - self-contained
  personas?: Array<{
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }>;

  // Explicit scenario type - self-contained
  scenario?: {
    persona_name?: string | null;
    persona_icon?: string | null;
    persona_color?: string | null;
  } | null;

  // Explicit chat type - self-contained
  current_chat?: {
    id: string;
    completed?: boolean | null;
  } | null;

  // Explicit hints type - self-contained
  current_chat_hints?: Array<{
    message_id: string;
    hints: Array<{
      simulation_message_id: string;
      hint: string;
      idx: number;
      created_at: string;
    }>;
  }>;

  // Callbacks
  send_message: (message: string, isRetry?: boolean) => void;
  is_sending_message: boolean;
  is_active: boolean;

  // Explicit simulation type - self-contained
  simulation?: {
    time_limit?: number | null;
    practice_simulation?: boolean | null;
  } | null;

  // Explicit background image type
  background_image?: string | null;

  // Standard props (like resource components)
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

export function MessagesView({
  messages: propMessages,
  streaming_content = new Map(),
  optimistic_messages = new Map(),
  personas = [],
  scenario,
  current_chat,
  current_chat_hints = [],
  send_message,
  is_sending_message,
  is_active,
  simulation,
  background_image,
  disabled = false,
  is_attempt_owner = true,
  chat_id,
}: MessagesViewProps) {
  const router = useRouter();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const targetChatId = chat_id || current_chat?.id;

  // Create persona lookup map
  const personaMap = useMemo(() => {
    return new Map(personas.map((p) => [p.id, p]));
  }, [personas]);

  // State for hints modal
  const [selectedHintMessageId, setSelectedHintMessageId] = useState<
    string | null
  >(null);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

  // Merge messages from props with optimistic messages and streaming content
  const messages = useMemo(() => {
    if (!propMessages) return Array.from(optimistic_messages.values());

    const messageMap = new Map<string, (typeof propMessages)[number]>();
    propMessages.forEach((msg) => {
      messageMap.set(msg.id, {
        ...msg,
        createdAt: msg.created_at,
        personaId: msg.persona_id ?? undefined,
      });
    });

    // Add optimistic messages
    optimistic_messages.forEach((optMsg, id) => {
      if (!messageMap.has(id)) {
        messageMap.set(id, {
          ...optMsg,
          createdAt: optMsg.created_at,
          personaId: optMsg.persona_id ?? undefined,
        });
      }
    });

    // Apply streaming content
    const messagesWithStreaming = Array.from(messageMap.values()).map((msg) => {
      const streaming = streaming_content.get(msg.id);
      if (
        streaming !== undefined &&
        (!msg.completed || streaming.length > msg.content.length)
      ) {
        return { ...msg, content: streaming };
      }
      return msg;
    });

    // Deduplicate user messages by content
    const deduplicatedMessages: typeof messagesWithStreaming = [];
    const seenContent = new Map<string, string>();

    for (const msg of messagesWithStreaming) {
      if (msg.type === "query") {
        const normalizedContent = normalizeMessageContent(msg.content);
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
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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

  const handleRetry = (errorMessageIndex: number) => {
    const sortedMessagesForRetry = messages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const previousUserMessage = sortedMessagesForRetry
      .slice(0, errorMessageIndex)
      .reverse()
      .find((msg) => msg.type === "query");

    if (previousUserMessage) {
      send_message(previousUserMessage.content, true);
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
                  // Render user messages (query type)
                  if (message.type === "query") {
                    const isOptimisticVoiceMessage =
                      message.id.startsWith("optimistic-user-voice-") &&
                      message.content === "";

                    return (
                      <div key={message.id} className="flex justify-end mb-3">
                        <div className="max-w-[80%] flex flex-col items-end gap-2">
                          <div className="flex items-stretch gap-2 w-full">
                            <div
                              className={`bg-primary text-primary-foreground rounded-lg p-3 flex-1 ${
                                isOptimisticVoiceMessage
                                  ? "flex items-center justify-center"
                                  : ""
                              }`}
                              data-testid={`message-${message.id}`}
                              data-message-id={message.id}
                              data-message-type="user"
                            >
                              {isOptimisticVoiceMessage ? (
                                <LoadingDots />
                              ) : (
                                <Markdown>{message.content}</Markdown>
                              )}
                            </div>
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
                      </div>
                    );
                  }

                  // Render assistant messages (response type)
                  if (message.type === "response") {
                    const hintsForMessage =
                      current_chat_hints.find(
                        (h) => h.message_id === message.id
                      )?.hints || [];
                    const shouldShowHintsButton =
                      simulation?.practice_simulation &&
                      hintsForMessage.length > 0;
                    const containerHeightClass = shouldShowHintsButton
                      ? "h-[52px] min-h-[52px] max-h-[52px]"
                      : "h-[26px] min-h-[26px] max-h-[26px]";
                    const hasNewHints = messagesWithNewHints.has(message.id);
                    const isSelected = selectedHintMessageId === message.id;

                    // Get persona data from message's personaId
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
                        <div className="max-w-[80%] flex flex-col gap-2">
                          <div className="flex items-stretch gap-2">
                            {/* Left-aligned stacked controls */}
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
                              {/* Show loading state for empty/incomplete messages */}
                              {!message.completed && message.content === "" ? (
                                <div
                                  className="bg-muted rounded-lg p-3 flex items-center justify-center"
                                  data-testid={`message-${message.id}`}
                                  data-message-id={message.id}
                                  data-message-type="assistant"
                                >
                                  <LoadingDots />
                                </div>
                              ) : message.completed &&
                                message.content === "" ? (
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
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <ReportProblem
                                          createFeedback={createFeedback}
                                          initialType="bug"
                                          initialMessage={`Error in simulation chat: ${message.content}\n\nChat ID: ${targetChatId}\nMessage ID: ${message.id}`}
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
                                      <TooltipContent>
                                        <p>Report this error</p>
                                      </TooltipContent>
                                    </Tooltip>
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
                                            current_chat?.completed ||
                                            is_sending_message ||
                                            (simulation?.time_limit
                                              ? !is_active
                                              : false) ||
                                            disabled
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
