/**
 * GroupRunMessages.tsx
 * Display multiple runs with messages stacked vertically.
 * Each run is shown in its own section with summary and messages.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Markdown from "@/components/common/chat/markdown/Markdown";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, User, Code, Settings } from "lucide-react";
import { useMemo } from "react";
import type { PricingGroupDetailOut } from "@/app/(main)/analytics/pricing/g/[groupRunId]/page";

export interface GroupRunMessagesProps {
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

export default function GroupRunMessages({
  groupDetail,
}: GroupRunMessagesProps) {
  const { runs, modelMapping, agentMapping, profileMapping } = groupDetail;

  // Sort runs chronologically
  const sortedRuns = useMemo(() => {
    return [...runs].sort(
      (a, b) =>
        new Date(a.run.createdAt).getTime() -
        new Date(b.run.createdAt).getTime()
    );
  }, [runs]);

  return (
    <div className="space-y-8">
      {sortedRuns.map((runWithMessages, index) => {
        const { run, messages } = runWithMessages;

        // Sort messages chronologically
        const sortedMessages = [...messages].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

        const modelName =
          run.modelId && modelMapping[run.modelId]
            ? modelMapping[run.modelId].name
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
          <div
            key={run.id}
            className="flex flex-col border rounded-lg p-6 bg-card"
          >
            {/* Run header */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                Run {index + 1} of {sortedRuns.length}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <div className="text-sm text-muted-foreground">Cost</div>
                  <div className="text-lg font-semibold">
                    {formatCost(run.cost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Input Tokens
                  </div>
                  <div className="text-lg font-semibold">
                    {formatNumber(run.inputTokens)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Output Tokens
                  </div>
                  <div className="text-lg font-semibold">
                    {formatNumber(run.outputTokens)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Cached Tokens
                  </div>
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
            <ScrollArea className="flex-1 border rounded-lg min-h-[400px] max-h-[600px]">
              <div className="space-y-4 p-4">
                {sortedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">No messages found for this run</p>
                  </div>
                ) : (
                  sortedMessages.map((message) => {
                    const isUser = message.role.toLowerCase() === "user";
                    const RoleIcon = getRoleIcon(message.role);
                    const roleLabel = getRoleLabel(message.role);

                    return (
                      <div
                        key={message.id}
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
                            <Markdown>{message.content}</Markdown>
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
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

