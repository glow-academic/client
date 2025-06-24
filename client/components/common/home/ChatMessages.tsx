/**
 * ChatMessages.tsx
 * Chat messages component with WebSocket streaming support
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";
import Markdown from "@/components/common/chat/Markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useChat } from "@/contexts/chat-context";
import { useRole } from "@/contexts/role-context";
import { AssistantMessage, AssistantToolCall } from "@/types";
import { logInfo } from "@/utils/logger";
import { getAssistantMessagesByChat } from "@/utils/queries/assistant_messages/get-assistant-messages-by-chat";
import { getAssistantToolCallsByChat } from "@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chat";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
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

// Component to display a tool call card
const ToolCallCard = ({ toolCall }: { toolCall: AssistantToolCall }) => {
  const getStatusIcon = () => {
    if (toolCall.completed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  };

  const getStatusText = () => {
    return toolCall.completed ? "Completed" : "Running";
  };

  const getStatusColor = () => {
    return toolCall.completed
      ? "bg-green-100 text-green-800"
      : "bg-blue-100 text-blue-800";
  };

  const formatToolName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Card className="mb-2 border-l-4 border-l-blue-500">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">
              {formatToolName(toolCall.toolName)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="secondary" className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Timeline item type for combining messages and tool calls
type TimelineItem = {
  id: string;
  type: "message" | "tool_call";
  timestamp: Date;
  data: AssistantMessage | AssistantToolCall;
};

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
    refetchInterval: isConnected ? false : 2000, // Faster polling when disconnected
    staleTime: isConnected ? 30000 : 0, // Keep data fresh when connected, always refetch when disconnected
    gcTime: isConnected ? 300000 : 0, // Cache longer when connected
    refetchOnWindowFocus: !isConnected, // Only refetch on focus when disconnected
    refetchOnReconnect: true, // Always refetch when network reconnects
  });

  const { data: toolCalls, isLoading: isLoadingToolCalls } = useQuery({
    queryKey: ["assistantToolCalls", currentChatId],
    queryFn: () => getAssistantToolCallsByChat(currentChatId!),
    enabled: !!currentChatId,
    refetchInterval: isConnected ? false : 2000, // Faster polling when disconnected
    staleTime: isConnected ? 30000 : 0, // Keep data fresh when connected, always refetch when disconnected
    gcTime: isConnected ? 300000 : 0, // Cache longer when connected
    refetchOnWindowFocus: !isConnected, // Only refetch on focus when disconnected
    refetchOnReconnect: true, // Always refetch when network reconnects
  });

  // Debug logging
  useEffect(() => {
    logInfo("ChatMessages - currentChatId", { currentChatId });
    logInfo("ChatMessages - messages", { messages });
    logInfo("ChatMessages - toolCalls", { toolCalls });
    logInfo("ChatMessages - isConnected", { isConnected });
  }, [currentChatId, messages, toolCalls, isConnected]);

  // Only show for instructor, instructional, or admin roles
  const shouldShow = ["instructor", "instructional", "admin"].includes(
    effectiveRole
  );

  // Create combined timeline of messages and tool calls
  const createTimeline = useCallback((): TimelineItem[] => {
    const timeline: TimelineItem[] = [];

    // Add messages to timeline
    if (messages) {
      messages.forEach((message) => {
        timeline.push({
          id: message.id,
          type: "message",
          timestamp: new Date(message.createdAt),
          data: message,
        });
      });
    }

    // Add tool calls to timeline
    if (toolCalls) {
      toolCalls.forEach((toolCall) => {
        timeline.push({
          id: toolCall.id,
          type: "tool_call",
          timestamp: new Date(toolCall.createdAt),
          data: toolCall,
        });
      });
    }

    // Sort by timestamp
    return timeline.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [messages, toolCalls]);

  // Auto-scroll to bottom when new items arrive
  useEffect(() => {
    const timeline = createTimeline();
    if (timeline && timeline.length > 0) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [createTimeline]);

  if (!shouldShow) {
    return null;
  }

  if ((isLoadingMessages || isLoadingToolCalls) && currentChatId) {
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

  const timeline = createTimeline();

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {timeline.map((item) => {
          if (item.type === "message") {
            const message = item.data as AssistantMessage;
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
                      <span className="text-gray-500 mr-2 text-sm">
                        Thinking
                      </span>
                      <LoadingDots />
                    </div>
                  ) : (
                    <div className="text-sm">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            const toolCall = item.data as AssistantToolCall;
            return (
              <div key={toolCall.id} className="flex justify-start">
                <div className="max-w-[80%] w-full">
                  <ToolCallCard toolCall={toolCall} />
                </div>
              </div>
            );
          }
        })}

        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
