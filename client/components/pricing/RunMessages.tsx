/**
 * RunMessages.tsx
 * Display run messages with role labels and pricing information for debugging.
 * Similar to AttemptMessages.tsx but simplified (no WebSocket, no streaming, no hints).
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
import type { PricingRunDetailOut } from "@/app/(main)/analytics/pricing/r/[runId]/page";

export interface RunMessagesProps {
  runDetail: PricingRunDetailOut;
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

export default function RunMessages({ runDetail }: RunMessagesProps) {
  const { run, messages, modelMapping, agentMapping, profileMapping } =
    runDetail;

  // Sort messages chronologically
  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

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
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
      {/* Run-level pricing summary */}
      <div className="border rounded-lg p-4 mb-4 bg-muted/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Cost</div>
            <div className="text-lg font-semibold">{formatCost(run.cost)}</div>
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
      <ScrollArea className="flex-1 border rounded-lg">
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
}

