/**
 * ChatMessages.tsx
 * Chat messages component for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import Markdown from "@/components/common/chat/Markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { AssistantMessage } from "@/types";
import { getAssistantMessagesByChat } from "@/utils/queries/assistant_messages/get-assistant-messages-by-chat";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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

export default function ChatMessages() {
  const { currentChatId } = useChat();
  const { effectiveRole } = useRole();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["assistantMessages", currentChatId],
    queryFn: () => getAssistantMessagesByChat(currentChatId!),
    enabled: !!currentChatId,
  });

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

  if (isLoadingMessages) {
    return (
      <div className="p-4 space-y-4">
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
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold">GLOW Assistant</h3>
          <p className="text-sm text-muted-foreground">
            I'm here to help you with questions about your courses, assignments,
            and academic planning.
          </p>
          <p className="text-xs text-muted-foreground">
            Type a message below to start our conversation
          </p>
        </div>
      </div>
    );
  }

  if (messages && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Chat started! Send a message to begin the conversation.
          </p>
        </div>
      </div>
    );
  }

  // Sort messages by creation time
  const sortedMessages = [...(messages || [])].sort(
    (a: AssistantMessage, b: AssistantMessage) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {sortedMessages.map((message: AssistantMessage) => (
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
              {message.content === "" && !message.completed ? (
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2 text-sm">Thinking</span>
                  <LoadingDots />
                </div>
              ) : (
                <div className="text-sm">
                  <Markdown>{message.content}</Markdown>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
