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
import { ArrowDown } from "lucide-react";

import Markdown from "@/components/common/chat/Markdown";
import { LoadingDots } from "@/components/ui/loading-dots";
import { useSimulation } from "@/contexts/simulation-context";
import { Simulation, SimulationMessage } from "@/types";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";

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
  const { currentChat, sendMessage, isSendingMessage } = useSimulation();
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Use the provided chatId or fall back to currentChat
  const targetChatId = chatId || currentChat?.id;

  // Fetch messages for target chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["simulationMessages", targetChatId],
    queryFn: () => getSimulationMessagesByChat(targetChatId!),
    enabled: !!targetChatId,
  });

  // Generate starter prompts
  const starterPrompts = useMemo(() => {
    const basePrompts = [
      "Hi, how are you?",
      "What can I help you with?",
      "I'm ready to assist you today",
    ];

    return basePrompts;
  }, []);

  // Handle starter prompt click
  const handleStarterPromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        // Hide scroll button after scrolling to bottom with a slight delay
        setTimeout(() => setShowScrollButton(false), 300);
      }
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
    return;
  }, [messages.length]);

  // Set up scroll event listener for the ScrollArea with increased threshold
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    if (!viewport) return;

    const handleScrollEvent = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      // Increased threshold from 20 to 100 pixels for less sensitivity
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      const hasScrollableContent = scrollHeight > clientHeight + 10;
      setShowScrollButton(hasScrollableContent && !isNearBottom);
    };

    // Initial check
    handleScrollEvent();

    // Add scroll listener
    viewport.addEventListener("scroll", handleScrollEvent);

    return () => {
      viewport.removeEventListener("scroll", handleScrollEvent);
    };
  }, [messages.length]);

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
      <ScrollArea className="flex-1 px-4 min-h-0" ref={scrollAreaRef}>
        <div className="space-y-4 py-4">
          {messages.length === 0 ? (
            /* Starter Prompts - shown when no messages */
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
                  {/* User Message */}
                  {message.type === "query" && (
                    <div className="flex justify-end mb-3">
                      <div className="max-w-[80%]">
                        <div className="bg-primary text-primary-foreground rounded-lg p-3">
                          <Markdown>{message.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assistant Response */}
                  {message.type === "response" && message.content !== "" && (
                    <div className="flex justify-start mb-3">
                      <div className="max-w-[80%]">
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
                  )}
                </div>
              ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button with smooth fade transition */}
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
    </div>
  );
}
