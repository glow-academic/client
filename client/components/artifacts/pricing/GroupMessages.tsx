/**
 * GroupMessages.tsx
 * Display multiple runs with messages stacked vertically.
 * Each run is shown in its own section with summary and messages.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import type { PricingGroupDetailOut } from "@/app/(main)/analytics/pricing/g/[groupId]/page";
import Markdown from "@/components/artifacts/attempt/chat/markdown/Markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Code,
  MessageSquare,
  Settings,
  User,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

export interface GroupMessagesProps {
  groupDetail: PricingGroupDetailOut;
}

const getRoleLabel = (role: string): string => {
  switch (role.toLowerCase()) {
    case "system":
      return "System";
    case "developer":
      return "Developer";
    case "user":
      return "User";
    case "assistant":
    case "response":
      return "Assistant";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const getRoleIcon = (role: string) => {
  switch (role.toLowerCase()) {
    case "system":
      return Settings;
    case "developer":
      return Code;
    case "user":
      return User;
    case "assistant":
    case "response":
      return MessageSquare;
    default:
      return MessageSquare;
  }
};

const formatDate = (dateString: string): string => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

const formatCost = (cost: number): string => {
  return `$${cost.toFixed(6)}`;
};

export default function GroupMessages({ groupDetail }: GroupMessagesProps) {
  const [currentRunIndex, setCurrentRunIndex] = useState(0);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showDeveloperPrompt, setShowDeveloperPrompt] = useState(false);
  const [showPreviousContext, setShowPreviousContext] = useState(true);
  const [showToolCalls, setShowToolCalls] = useState(true);

  // This component only handles group responses (has 'runs' property)
  // Type assertion is safe here since this component is specifically for groups
  const isGroupResponse = "runs" in groupDetail;
  
  // Type guard to ensure we have group response
  type GroupResponseType = PricingGroupDetailOut & { runs: unknown[]; models?: unknown[]; agents?: unknown[]; profiles?: unknown[] };
  const groupResponse = isGroupResponse ? (groupDetail as GroupResponseType) : null;
  
  // Type for tool calls
  type CallItem = {
    id: string;
    template_name: string | null;
    arguments: string | null;
    created_at: string;
  };

  const runs = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.runs ?? []) as Array<{ run: { created_at: string; model_id: string | null; agent_id: string | null; profile_id: string | null; cost: number | null; input_tokens: number | null; [key: string]: unknown }; messages: Array<{ id: string | null; role: string | null; contents: Array<{ content: string | null; [key: string]: unknown }> | null; calls?: CallItem[]; [key: string]: unknown }>; previous_context_start_index: number | null }>;
  }, [groupResponse]);
  
  // Use arrays directly (no mapping construction)
  const models = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.models || []) as Array<{ model_id: string | null; name: string | null; [key: string]: unknown }>;
  }, [groupResponse]);
  const agents = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.agents || []) as Array<{ agent_id: string | null; name: string | null; [key: string]: unknown }>;
  }, [groupResponse]);
  const profiles = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.profiles || []) as Array<{ profile_id: string | null; name: string | null; [key: string]: unknown }>;
  }, [groupResponse]);

  // Sort runs chronologically
  const sortedRuns = useMemo(() => {
    if (!groupResponse || runs.length === 0) {
      return [];
    }
    return [...runs].sort(
      (a, b) =>
        new Date(a.run.created_at).getTime() -
        new Date(b.run.created_at).getTime()
    );
  }, [runs, groupResponse]);

  // Get current run
  const currentRun = sortedRuns[currentRunIndex];

  // Filter messages based on toggle switches
  // Use the message type from the run structure
  type MessageItem = { id: string | null; role: string | null; contents: Array<{ content: string | null; [key: string]: unknown }> | null; calls?: CallItem[]; [key: string]: unknown };
  const filteredMessages = useMemo(() => {
    if (!currentRun) {
      return [];
    }

    // First filter by previous context (if needed)
    let messagesToFilter = currentRun.messages as MessageItem[];
    if (
      !showPreviousContext &&
      currentRun.previous_context_start_index !== null &&
      currentRun.previous_context_start_index !== undefined
    ) {
      // Hide messages before the previous_context_start_index (these are from previous runs)
      messagesToFilter = currentRun.messages.slice(
        currentRun.previous_context_start_index
      ) as MessageItem[];
    }

    // Then filter by system/developer toggles
    return messagesToFilter.filter((message) => {
      const role = (message.role || "").toLowerCase();

      // Filter by system/developer toggles
      if (role === "system" && !showSystemPrompt) {
        return false;
      }
      if (role === "developer" && !showDeveloperPrompt) {
        return false;
      }

      return true;
    });
  }, [currentRun, showSystemPrompt, showDeveloperPrompt, showPreviousContext]);

  if (!isGroupResponse) {
    return null; // This component only handles group responses
  }

  if (!currentRun) {
    return null;
  }

  const { run } = currentRun;
  // Messages are already ordered by message_tree from server, no need to sort

  const modelName =
    run["model_id"]
      ? (models.find((m) => m["model_id"] === run["model_id"])?.["name"] ?? run["model_id"])
      : "Unknown";
  const agentName =
    run["agent_id"]
      ? (agents.find((a) => a["agent_id"] === run["agent_id"])?.["name"] ?? run["agent_id"])
      : "Unknown";
  const profileName =
    run["profile_id"]
      ? (profiles.find((p) => p["profile_id"] === run["profile_id"])?.["name"] ?? run["profile_id"])
      : "Unknown";

  return (
    <div className="flex flex-col">
      {/* Current Run Display */}
      <div className="flex flex-col border rounded-lg p-6 bg-card max-h-[700px] min-h-0 overflow-hidden">
        {/* Run header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">
              Run {currentRunIndex + 1} of {sortedRuns.length}
            </h3>
            <div className="flex items-center gap-4">
              {currentRunIndex > 0 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-previous-context"
                    checked={showPreviousContext}
                    onCheckedChange={setShowPreviousContext}
                  />
                  <Label
                    htmlFor="show-previous-context"
                    className="text-sm cursor-pointer"
                  >
                    Show previous context
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="show-system-prompt"
                  checked={showSystemPrompt}
                  onCheckedChange={setShowSystemPrompt}
                />
                <Label
                  htmlFor="show-system-prompt"
                  className="text-sm cursor-pointer"
                >
                  Show system prompt
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-developer-prompt"
                  checked={showDeveloperPrompt}
                  onCheckedChange={setShowDeveloperPrompt}
                />
                <Label
                  htmlFor="show-developer-prompt"
                  className="text-sm cursor-pointer"
                >
                  Show developer prompt
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-tool-calls"
                  checked={showToolCalls}
                  onCheckedChange={setShowToolCalls}
                />
                <Label
                  htmlFor="show-tool-calls"
                  className="text-sm cursor-pointer"
                >
                  Show tool calls
                </Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-sm text-muted-foreground">Cost</div>
              <div className="text-lg font-semibold">
                {formatCost((run["cost"] as number) ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Input Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber((run["input_tokens"] as number) ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Output Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber((run["output_tokens"] as number) ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cached Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber((run["cached_input_tokens"] as number) ?? 0)}
              </div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Model: </span>
              <span className="font-medium">{modelName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span className="font-medium">{agentName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Profile: </span>
              <span className="font-medium">{profileName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="font-medium">{formatDate(run.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Messages list */}
        <ScrollArea className="border rounded-lg h-[500px] min-h-0">
          <TooltipProvider>
            <div className="space-y-4 p-4">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No messages found for this run</p>
                </div>
              ) : (
                filteredMessages.map((message) => {
                  const msg = message as MessageItem;
                  const role = msg.role || "";
                  const isUser = role.toLowerCase() === "user";
                  const RoleIcon = getRoleIcon(role);
                  const roleLabel = getRoleLabel(role);

                  // Check if this is the boundary between previous context and current run
                  // Find the original index in the unfiltered messages array
                  const originalIndex = currentRun.messages.findIndex(
                    (m) => (m as MessageItem).id === msg.id
                  );
                  const isPreviousContextBoundary =
                    currentRun.previous_context_start_index !== null &&
                    currentRun.previous_context_start_index !== undefined &&
                    originalIndex === currentRun.previous_context_start_index &&
                    showPreviousContext; // Only show boundary when previous context is visible

                  // Get calls attached to this message
                  const messageCalls = (msg.calls || []) as CallItem[];

                  return (
                    <div key={msg.id || `msg-${originalIndex}`}>
                      {isPreviousContextBoundary && (
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dashed border-muted-foreground/30" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-2 text-muted-foreground">
                              Previous context
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Tool calls attached to this message */}
                      {showToolCalls && messageCalls.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {messageCalls.map((call) => (
                            <div
                              key={call.id}
                              className={cn(
                                "flex gap-2",
                                isUser ? "justify-end" : "justify-start"
                              )}
                            >
                              {!isUser && (
                                <div className="flex-shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Tool Call</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                              <details className="group max-w-[60%]">
                                <summary className={cn(
                                  "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-mono font-medium",
                                  "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800",
                                  "text-amber-700 dark:text-amber-300",
                                  "hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors",
                                  "list-none flex items-center gap-1.5"
                                )}>
                                  <Wrench className="h-3 w-3 inline-block" />
                                  {call.template_name || "tool_call"}
                                  <span className="text-amber-500 dark:text-amber-500 ml-1 group-open:rotate-90 transition-transform">
                                    ▶
                                  </span>
                                </summary>
                                {call.arguments && (
                                  <pre className="mt-1 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words">
                                    <code className="text-amber-800 dark:text-amber-200">
                                      {(() => {
                                        try {
                                          return JSON.stringify(
                                            JSON.parse(call.arguments),
                                            null,
                                            2
                                          );
                                        } catch {
                                          return call.arguments;
                                        }
                                      })()}
                                    </code>
                                  </pre>
                                )}
                              </details>
                              {isUser && (
                                <div className="flex-shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                        <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Tool Call</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex gap-3",
                          isUser ? "justify-end" : "justify-start"
                        )}
                      >
                        {!isUser && (
                          <div className="flex-shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                                  <RoleIcon className="h-4 w-4" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{roleLabel}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex flex-col gap-1 max-w-[80%]",
                            isUser ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-lg p-3",
                              isUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            {msg.contents && msg.contents.length > 0 ? (
                              <div className="space-y-2">
                                {msg.contents.map(
                                  (contentItem, contentIdx: number) => {
                                    const content = contentItem as { content: string | null; [key: string]: unknown };
                                    return (
                                      <div
                                        key={contentIdx}
                                        className="flex items-start gap-2"
                                      >
                                        {contentIdx > 0 && (
                                          <div className="w-0.5 h-full bg-border mt-1.5 min-h-[1rem]" />
                                        )}
                                        <div className="flex-1">
                                          <Markdown>
                                            {content.content || ""}
                                          </Markdown>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            ) : (
                              // Fallback for backward compatibility
                              <Markdown>
                                {message.contents && message.contents.length > 0
                                  ? message.contents[0]?.content || ""
                                  : ""}
                              </Markdown>
                            )}
                          </div>
                        </div>
                        {isUser && (
                          <div className="flex-shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{roleLabel}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TooltipProvider>
        </ScrollArea>
      </div>

      {/* Pagination Footer - Run Navigation */}
      {sortedRuns.length > 1 && (
        <div className="border-t px-4 py-3 flex items-center bg-background relative">
          {/* Left Side - First and Previous Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(0)}
              disabled={currentRunIndex === 0}
            >
              <span className="sr-only">Go to first run</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(currentRunIndex - 1)}
              disabled={currentRunIndex === 0}
            >
              <span className="sr-only">Go to previous run</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Center - Current Run Info */}
          <div className="flex items-center gap-2 px-4 absolute left-1/2 -translate-x-1/2">
            <span className="text-sm font-medium">
              Run {currentRunIndex + 1} of {sortedRuns.length}
            </span>
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Right Side - Next and Last Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(currentRunIndex + 1)}
              disabled={currentRunIndex >= sortedRuns.length - 1}
            >
              <span className="sr-only">Go to next run</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(sortedRuns.length - 1)}
              disabled={currentRunIndex >= sortedRuns.length - 1}
            >
              <span className="sr-only">Go to last run</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
