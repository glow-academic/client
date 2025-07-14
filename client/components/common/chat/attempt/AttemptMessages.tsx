/**
 * AttemptMessages.tsx
 * Used to display the attempt messages. This will show the messages from the assistant, and the user. It will properly handle loading states, and will call as needed the above functions for context. It will eventually be able to play audio for each message and provide more custom streaming logic.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// Tooltip
import { TooltipProvider } from "@/components/ui/tooltip";

import Markdown from "@/components/common/chat/Markdown";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";

export interface AttemptMessagesProps {
  chatId?: string;
}

export default function AttemptMessages({ chatId }: AttemptMessagesProps) {
  const simulationContext = useSimulation();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const targetChatId = chatId || simulationContext?.currentChat?.id;

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
                  .map((message) => (
                    <div key={message.id} className="space-y-3">
                      {message.type === "query" && (
                        <div className="flex justify-end mb-3">
                          <div className="max-w-[80%]">
                            <div className="bg-primary text-primary-foreground rounded-lg p-3">
                              <Markdown>
                                {message.content}
                              </Markdown>
                            </div>
                          </div>
                        </div>
                      )}

                      {message.type === "response" && (
                        <div className="flex justify-start mb-3">
                          <div className="max-w-[80%]">
                            {/* Show loading state for empty/incomplete messages, otherwise show content */}
                            {!message.completed &&
                            message.content === "" ? (
                              <div className="bg-muted rounded-lg p-3">
                                <div className="flex items-center">
                                  <span className="text-gray-500 mr-2">
                                    Analyzing
                                  </span>
                                  <LoadingDots />
                                </div>
                              </div>
                            ) : message.completed &&
                              message.content === "" ? (
                              // Show "No response" for completed messages with empty content
                              <div className="bg-muted rounded-lg p-3">
                                <span className="text-gray-500 italic">
                                  No response
                                </span>
                              </div>
                            ) : (
                              <div className="bg-muted rounded-lg p-3 relative">
                                <Markdown>
                                  {message.content}
                                </Markdown>
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
      </TooltipProvider>
    </div>
  );
}
