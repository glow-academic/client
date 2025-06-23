/**
 * ChatMessages.tsx
 * Chat messages component with WebSocket streaming support
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import Markdown from "@/components/common/chat/Markdown";
import ToolCall from "@/components/common/chat/ToolCall";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AssistantMessageWithTools, useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { AssistantMessage } from "@/types";
import { logInfo } from "@/utils/logger";
import { getAssistantMessagesByChat } from "@/utils/queries/assistant_messages/get-assistant-messages-by-chat";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import ChatStarterPrompts from "./ChatStarterPrompts";

const LoadingDots = () => (
  <div className="flex space-x-1">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </div>
);

interface ChatMessagesProps {
  onPromptClick?: (prompt: string) => void;
}

export default function ChatMessages({
  onPromptClick,
}: ChatMessagesProps = {}) {
  const { currentChatId, isConnected } = useChat();
  const { effectiveRole } = useRole();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["assistantMessages", currentChatId],
    queryFn: () => getAssistantMessagesByChat(currentChatId!),
    enabled: !!currentChatId,
    refetchInterval: isConnected ? false : 5000, // Poll when disconnected
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    gcTime: 0, // Don't cache for long
  });

  // Debug logging
  useEffect(() => {
    logInfo("ChatMessages - currentChatId", { currentChatId });
    logInfo("ChatMessages - messages", { messages });
    logInfo("ChatMessages - isConnected", { isConnected });
  }, [currentChatId, messages, isConnected]);

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [messages, messages?.length]);

  if (!shouldShow) {
    return null;
  }

  if (isLoadingMessages && currentChatId) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!currentChatId) {
    return <ChatStarterPrompts onPromptClick={onPromptClick || (() => {})} />;
  }

  // Sort messages by creation time
  const sortedMessages = [...(messages || [])].sort(
    (a: AssistantMessage, b: AssistantMessage) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {sortedMessages.map((message: AssistantMessage) => {
          const messageWithTools = message as AssistantMessageWithTools;
          return (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "assistant" &&
                !message.completed &&
                message.content === "" ? (
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2 text-sm">Thinking</span>
                    <LoadingDots />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Show tool calls for assistant messages */}
                    {message.role === "assistant" &&
                      messageWithTools.toolCalls &&
                      messageWithTools.toolCalls.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {messageWithTools.toolCalls.map((toolCall) => {
                            const toolResult =
                              messageWithTools.toolResults?.find(
                                (tr) => tr.id === toolCall.id
                              );
                            return (
                              <ToolCall
                                key={toolCall.id}
                                toolCall={toolCall}
                                {...(toolResult && { toolResult })}
                              />
                            );
                          })}
                        </div>
                      )}

                    {/* Show message content */}
                    <div className="text-sm">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
