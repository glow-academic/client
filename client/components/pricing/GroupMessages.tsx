/**
 * GroupMessages.tsx
 * Display multiple runs with messages stacked vertically.
 * Each run is shown in its own section with summary and messages.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import type { PricingGroupDetailOut } from "@/app/(main)/analytics/pricing/g/[groupId]/page";
import Markdown from "@/components/common/chat/markdown/Markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { components } from "@/lib/api/schema";
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

  // This component only handles group responses (has 'runs' property)
  // Type assertion is safe here since this component is specifically for groups
  const isGroupResponse = "runs" in groupDetail;
  const groupDetailTyped = useMemo(() => {
    return isGroupResponse
      ? (groupDetail as Extract<PricingGroupDetailOut, { runs: unknown }>)
      : null;
  }, [groupDetail, isGroupResponse]);

  const runs = useMemo(() => groupDetailTyped?.runs ?? [], [groupDetailTyped]);
  const modelMapping = groupDetailTyped?.modelMapping ?? {};
  const agentMapping = groupDetailTyped?.agentMapping ?? {};
  const profileMapping = groupDetailTyped?.profileMapping ?? {};

  // Sort runs chronologically
  const sortedRuns = useMemo(() => {
    if (!isGroupResponse || runs.length === 0) {
      return [];
    }
    return [...runs].sort(
      (a, b) =>
        new Date(a.run.createdAt).getTime() -
        new Date(b.run.createdAt).getTime()
    );
  }, [runs, isGroupResponse]);

  // Get current run
  const currentRun = sortedRuns[currentRunIndex];

  // Filter messages based on toggle switches
  type MessageItem =
    components["schemas"]["app__api__v3__pricing__detail__MessageItem"];
  const filteredMessages = useMemo(() => {
    if (!currentRun) {
      return [];
    }

    // First filter by previous context (if needed)
    let messagesToFilter = currentRun.messages;
    if (
      !showPreviousContext &&
      currentRun.previousContextStartIndex !== null &&
      currentRun.previousContextStartIndex !== undefined
    ) {
      // Hide messages before the previousContextStartIndex (these are from previous runs)
      messagesToFilter = currentRun.messages.slice(
        currentRun.previousContextStartIndex
      );
    }

    // Then filter by system/developer toggles
    return messagesToFilter.filter((message: MessageItem) => {
      const role = message.role.toLowerCase();

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
    run.modelId && modelMapping[run.modelId]
      ? (modelMapping[run.modelId]?.["name"] ?? run.modelId)
      : run.modelId || "Unknown";
  const agentName =
    run.agentId && agentMapping[run.agentId]
      ? agentMapping[run.agentId]
      : run.agentId || "Unknown";
  const profileName =
    run.profileId && profileMapping[run.profileId]
      ? profileMapping[run.profileId]
      : run.profileId || "Unknown";

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
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-sm text-muted-foreground">Cost</div>
              <div className="text-lg font-semibold">
                {formatCost(run.cost)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Input Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(run.inputTokens)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Output Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(run.outputTokens)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cached Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(run.cachedInputTokens)}
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
              <span className="font-medium">{formatDate(run.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Messages list */}
        <ScrollArea className="border rounded-lg h-[500px] min-h-0">
          <div className="space-y-4 p-4">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No messages found for this run</p>
              </div>
            ) : (
              filteredMessages.map((message: MessageItem) => {
                const isUser = message.role.toLowerCase() === "user";
                const RoleIcon = getRoleIcon(message.role);
                const roleLabel = getRoleLabel(message.role);

                // Check if this is the boundary between previous context and current run
                // Find the original index in the unfiltered messages array
                const originalIndex = currentRun.messages.findIndex(
                  (m) => m.id === message.id
                );
                const isPreviousContextBoundary =
                  currentRun.previousContextStartIndex !== null &&
                  currentRun.previousContextStartIndex !== undefined &&
                  originalIndex === currentRun.previousContextStartIndex &&
                  showPreviousContext; // Only show boundary when previous context is visible

                return (
                  <div key={message.id}>
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
                    <div
                      className={cn(
                        "flex gap-3",
                        isUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isUser && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                            <RoleIcon className="h-4 w-4" />
                          </div>
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
                          {message.contents && message.contents.length > 0 ? (
                            <div className="space-y-2">
                              {message.contents.map(
                                (contentItem, contentIdx) => (
                                  <div
                                    key={contentIdx}
                                    className="flex items-start gap-2"
                                  >
                                    {contentIdx > 0 && (
                                      <div className="w-0.5 h-full bg-border mt-1.5 min-h-[1rem]" />
                                    )}
                                    <div className="flex-1">
                                      <Markdown>{contentItem.content}</Markdown>
                                      {contentIdx > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1 opacity-70">
                                          Version {contentItem.idx + 1}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                          <Badge variant="outline" className="text-xs">
                            {roleLabel}
                          </Badge>
                          <span>{formatDate(message.createdAt)}</span>
                          {message.updatedAt !== message.createdAt && (
                            <span className="text-muted-foreground/70">
                              (updated {formatDate(message.updatedAt)})
                            </span>
                          )}
                          {message.completed && (
                            <Badge variant="secondary" className="text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isUser && (
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
