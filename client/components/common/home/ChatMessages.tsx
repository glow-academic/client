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
import { useAssistant } from "@/contexts/assistant-context";
import { AssistantMessage, AssistantToolCall } from "@/types";
import { logInfo } from "@/utils/logger";
import { getAssistantMessagesByChat } from "@/utils/queries/assistant_messages/get-assistant-messages-by-chat";
import { getAssistantToolCallsByChat } from "@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chat";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, CheckCircle, Loader2, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatStarterPrompts from "./ChatStarterPrompts";
import GlowHeader from "./GlowHeader";

// MODIFIED: Added variant prop to adjust dot size
const LoadingDots = ({
  variant = "expanded",
}: {
  variant?: "expanded" | "minimized";
}) => (
  <div className="flex space-x-1">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        // MODIFIED: Conditional dot size
        className={`bg-muted-foreground rounded-full animate-pulse ${
          variant === "minimized" ? "w-1.5 h-1.5" : "w-2 h-2"
        }`}
        style={{ animationDelay: `${i * 0.2}s` }}
      />
    ))}
  </div>
);

// MODIFIED: Added variant prop to adjust card size
const ToolCallCard = ({
  toolCall,
  variant,
}: {
  toolCall: AssistantToolCall;
  variant: "expanded" | "minimized";
}) => {
  const isMinimized = variant === "minimized";

  const getStatusIcon = () => {
    if (toolCall.completed) {
      // MODIFIED: Conditional icon size
      return (
        <CheckCircle
          className={`text-green-500 ${isMinimized ? "h-3.5 w-3.5" : "h-4 w-4"}`}
        />
      );
    }
    // MODIFIED: Conditional icon size
    return (
      <Loader2
        className={`animate-spin text-blue-500 ${
          isMinimized ? "h-3.5 w-3.5" : "h-4 w-4"
        }`}
      />
    );
  };

  const getStatusText = () => {
    return toolCall.completed ? "Completed" : "Running";
  };

  const getStatusColor = () => {
    return toolCall.completed
      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
  };

  const formatToolName = (name: string) => {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getToolDescription = (
    toolName: string,
    args: Record<string, unknown>
  ) => {
    const descriptions: Record<
      string,
      (args: Record<string, unknown>) => string
    > = {
      _profile_overview: (args) =>
        `Fetch profile details for ${args["key"] || "user"}`,
      _class_overview: (_args) => `Fetch class information`,
      _cohort_overview: (_args) => `Fetch cohort details`,
      _simulation_overview: (_args) => `Fetch simulation information`,
      _scenario_overview: (_args) => `Fetch scenario details`,
      _agent_overview: (_args) => `Fetch agent information`,
      _find_profiles: (args) =>
        `Search for profiles matching "${args["query"] || ""}"`,
      _find_classes: (args) =>
        `Search for classes matching "${args["query"] || ""}"`,
      _find_simulations: (args) =>
        `Search for simulations matching "${args["query"] || ""}"`,
      _student_sim_report: (_args) => `Generate student simulation report`,
      _class_gradebook: (_args) => `Generate class gradebook`,
      _cohort_pass_matrix: (_args) => `Generate cohort performance matrix`,
      _simulation_attempts: (args) =>
        `Fetch simulation attempts (${args["limit"] || 200} records)`,
      _agent_response_times: (args) =>
        `Analyze agent response times (${args["window_days"] || 30} days)`,
      _recent_app_logs: (args) =>
        `Fetch recent ${args["level"] || "error"} logs (${
          args["limit"] || 100
        } records)`,
      _export_csv: (_args) => `Export data to CSV`,
      _assistant_usage: (args) =>
        `Analyze assistant usage (${args["days"] || 7} days)`,
      _query_data: (_args) => `Execute custom database query`,
      _list_schema: () => `List database schema information`,
    };

    const description = descriptions[toolName];
    return description
      ? description(args)
      : `Execute ${formatToolName(toolName)}`;
  };

  return (
    // MODIFIED: Conditional margin
    <Card
      className={`border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/30 to-indigo-50/30 dark:from-blue-900/5 dark:to-indigo-900/5 hover:shadow-sm transition-all duration-200 p-0`}
    >
      {/* MODIFIED: Conditional padding */}
      <CardContent className={isMinimized ? "p-2" : "p-4"}>
        <div className="flex items-center justify-between">
          {/* MODIFIED: Conditional gap */}
          <div
            className={`flex items-center ${isMinimized ? "gap-2" : "gap-3"}`}
          >
            {/* MODIFIED: Conditional icon container size */}
            <div
              className={`bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 ${
                isMinimized ? "w-6 h-6" : "w-8 h-8"
              }`}
            >
              {/* MODIFIED: Conditional icon size */}
              <Wrench
                className={`text-white ${isMinimized ? "h-3.5 w-3.5" : "h-4 w-4"}`}
              />
            </div>
            <div className="flex flex-col">
              {/* MODIFIED: Conditional font size */}
              <span
                className={`font-medium text-gray-900 dark:text-gray-100 ${
                  isMinimized ? "text-xs" : "text-sm"
                }`}
              >
                {formatToolName(toolCall.toolName)}
              </span>
              <span className="text-xs text-muted-foreground">
                {getToolDescription(
                  toolCall.toolName,
                  toolCall.toolArguments as Record<string, unknown>
                )}
              </span>
            </div>
          </div>
          {/* MODIFIED: Conditional gap */}
          <div
            className={`flex items-center ${isMinimized ? "gap-1" : "gap-2"}`}
          >
            {getStatusIcon()}
            {/* MODIFIED: Conditional badge size */}
            <Badge
              variant="secondary"
              className={`${getStatusColor()} ${
                isMinimized ? "text-xs px-1.5 py-0" : ""
              }`}
            >
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

export interface ChatMessagesProps {
  onPromptClick?: (prompt: string) => void;
  showPrompts?: boolean;
  variant?: "expanded" | "minimized";
}

export default function ChatMessages({
  onPromptClick,
  showPrompts,
  variant = "expanded",
}: ChatMessagesProps = {}) {
  const { currentChatId, isConnected } = useAssistant();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Track if user is scrolled to bottom
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Track if there are new messages after user scrolled up
  const [showScrollDown, setShowScrollDown] = useState(false);

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["assistantMessages", currentChatId],
    queryFn: () => getAssistantMessagesByChat(currentChatId!),
    enabled: !!currentChatId,
    refetchInterval: isConnected ? false : 2000,
    staleTime: isConnected ? 30000 : 0,
    gcTime: isConnected ? 300000 : 0,
    refetchOnWindowFocus: !isConnected,
    refetchOnReconnect: true,
  });

  const { data: toolCalls, isLoading: isLoadingToolCalls } = useQuery({
    queryKey: ["assistantToolCalls", currentChatId],
    queryFn: () => getAssistantToolCallsByChat(currentChatId!),
    enabled: !!currentChatId,
    refetchInterval: isConnected ? false : 2000,
    staleTime: isConnected ? 30000 : 0,
    gcTime: isConnected ? 300000 : 0,
    refetchOnWindowFocus: !isConnected,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    logInfo("ChatMessages - currentChatId", { currentChatId });
    logInfo("ChatMessages - messages", { messages });
    logInfo("ChatMessages - toolCalls", { toolCalls });
    logInfo("ChatMessages - isConnected", { isConnected });
  }, [currentChatId, messages, toolCalls, isConnected]);

  const createTimeline = useCallback((): TimelineItem[] => {
    const timeline: TimelineItem[] = [];
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
    return timeline.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [messages, toolCalls]);

  // Scroll to bottom when new messages arrive, unless user has scrolled up
  useEffect(() => {
    const timeline = createTimeline();
    if (timeline.length > 0) {
      if (isAtBottom) {
        const timer = setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        return () => clearTimeout(timer);
      } else {
        // If not at bottom, show scroll down icon
        setShowScrollDown(true);
      }
    }
    return () => {};
  }, [createTimeline, isAtBottom]);

  // Listen for scroll events to determine if user is at bottom
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Find the scrollable div inside ScrollArea
      const scrollable =
        scrollContainer.querySelector("[data-radix-scroll-area-viewport]") ||
        scrollContainer;
      if (!scrollable) return;

      const { scrollTop, scrollHeight, clientHeight } =
        scrollable as HTMLElement;
      // Consider at bottom if within 32px of bottom
      const atBottom = scrollHeight - scrollTop - clientHeight < 32;
      setIsAtBottom(atBottom);
      if (atBottom) setShowScrollDown(false);
    };

    // Attach to the scrollable viewport
    const scrollable =
      scrollContainer.querySelector("[data-radix-scroll-area-viewport]") ||
      scrollContainer;
    if (scrollable) {
      scrollable.addEventListener("scroll", handleScroll);
    }

    // Initial check
    handleScroll();

    return () => {
      if (scrollable) {
        scrollable.removeEventListener("scroll", handleScroll);
      }
    };
  }, [scrollAreaRef, messages, toolCalls]);

  // When user clicks scroll down, scroll to bottom and hide icon
  const handleScrollDown = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
    setIsAtBottom(true);
  };

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
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col justify-center items-center gap-8 max-w-5xl w-full h-full">
          <GlowHeader />
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              showPrompts ? "opacity-100 max-h-96" : "opacity-0 max-h-0"
            }`}
          >
            <ChatStarterPrompts
              onPromptClick={onPromptClick || (() => {})}
              variant="expanded"
            />
          </div>
        </div>
      </div>
    );
  }

  const timeline = createTimeline();

  return (
    <div className="relative h-full">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        {/* MODIFIED: Conditional padding and spacing */}
        <div
          className={
            variant === "minimized" ? "p-1 space-y-2" : "p-2 space-y-4"
          }
        >
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
                    // MODIFIED: Conditional padding and rounding
                    className={`max-w-[80%] shadow-md ${
                      variant === "minimized"
                        ? "rounded-lg p-2"
                        : "rounded-xl p-4"
                    } ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
                    }`}
                  >
                    {message.role === "assistant" &&
                    !message.completed &&
                    message.content === "" ? (
                      <div className="flex items-center">
                        {/* MODIFIED: Conditional font size and margin */}
                        <span
                          className={`text-muted-foreground ${
                            variant === "minimized"
                              ? "text-xs mr-1.5"
                              : "text-sm mr-2"
                          }`}
                        >
                          Thinking
                        </span>
                        {/* MODIFIED: Pass variant to LoadingDots */}
                        <LoadingDots variant={variant} />
                      </div>
                    ) : (
                      // MODIFIED: Conditional font size and leading
                      <div
                        className={
                          variant === "minimized"
                            ? "text-xs leading-normal"
                            : "text-sm leading-relaxed"
                        }
                      >
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
                    {/* MODIFIED: Pass variant to ToolCallCard */}
                    <ToolCallCard toolCall={toolCall} variant={variant} />
                  </div>
                </div>
              );
            }
          })}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      {/* Arrow Down Scroll Icon */}
      {showScrollDown && (
        <button
          aria-label="Scroll to latest"
          onClick={handleScrollDown}
          className="absolute z-20 left-1/2 -translate-x-1/2 bottom-4 bg-blue-500 dark:bg-blue-600 border border-blue-700 dark:border-blue-400 shadow-lg rounded-full p-2 hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
          style={{ boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
        >
          <ArrowDown className="h-4 w-4 text-white" />
        </button>
      )}
    </div>
  );
}
