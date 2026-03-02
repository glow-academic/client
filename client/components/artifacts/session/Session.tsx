/**
 * Session.tsx
 * Unified event timeline showing all session activity chronologically.
 * @AshokSaravanan222
 * 03/01/2026
 */
"use client";

import type { SessionDetailOut } from "@/app/(main)/session/[sessionId]/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, Layers, LogIn, MessageSquare, Play, ScrollText, Target,
} from "lucide-react";
import Link from "next/link";

export interface SessionProps {
  sessionDetail: SessionDetailOut;
}

type TimelineEvent = {
  event_type?: string | null;
  entity_id?: string | null;
  entity_name?: string | null;
  created_at?: string | null;
  extra_1?: string | null;
  extra_2?: string | null;
};

type GroupItem = {
  group_id: string;
  group_name?: string | null;
  trace_id?: string | null;
  first_run_at?: string | null;
  last_run_at?: string | null;
  run_count: number;
  total_tokens: number;
  total_cost: string;
};

const formatDate = (dateString: string): string => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
};

const formatNumber = (num: number): string => new Intl.NumberFormat("en-US").format(num);

const formatCost = (cost: string): string => {
  const num = parseFloat(cost);
  if (isNaN(num)) return "$0.000000";
  return `$${num.toFixed(6)}`;
};

const EVENT_CONFIG: Record<string, {
  label: string;
  borderColor: string;
  bgColor: string;
  icon: typeof Layers;
  iconColor: string;
}> = {
  group: {
    label: "Group",
    borderColor: "border-l-primary",
    bgColor: "bg-primary/5",
    icon: Layers,
    iconColor: "text-primary",
  },
  login: {
    label: "Login",
    borderColor: "border-l-muted-foreground",
    bgColor: "bg-muted/30",
    icon: LogIn,
    iconColor: "text-muted-foreground",
  },
  problem: {
    label: "Problem",
    borderColor: "border-l-destructive",
    bgColor: "bg-destructive/5",
    icon: AlertTriangle,
    iconColor: "text-destructive",
  },
  chat: {
    label: "Chat",
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-500/5",
    icon: MessageSquare,
    iconColor: "text-blue-500",
  },
  attempt: {
    label: "Attempt",
    borderColor: "border-l-green-500",
    bgColor: "bg-green-500/5",
    icon: Target,
    iconColor: "text-green-500",
  },
  practice: {
    label: "Practice",
    borderColor: "border-l-teal-500",
    bgColor: "bg-teal-500/5",
    icon: Play,
    iconColor: "text-teal-500",
  },
};

export default function Session({ sessionDetail }: SessionProps) {
  const groups = (sessionDetail.groups ?? []) as GroupItem[];
  const timeline = (sessionDetail.timeline ?? []) as TimelineEvent[];

  // Build group lookup for enrichment
  const groupMap = new Map<string, GroupItem>();
  for (const g of groups) {
    groupMap.set(g.group_id, g);
  }

  if (!sessionDetail.session_exists) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Session not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Session Detail</CardTitle>
            <Badge variant={sessionDetail.active ? "default" : "secondary"}>
              {sessionDetail.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Profile: </span>
              <span className="font-medium">{sessionDetail.profile_name ?? "Unknown"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="font-medium">
                {sessionDetail.session_created_at
                  ? formatDate(sessionDetail.session_created_at)
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Events: </span>
              <span className="font-medium">{formatNumber(timeline.length)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Groups: </span>
              <span className="font-medium">{formatNumber(groups.length)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Timeline */}
      <div className="border rounded-lg flex-1 min-h-0 overflow-hidden flex flex-col bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Timeline</h3>
        </div>
        <ScrollArea className="flex-1 h-[500px]">
          <TooltipProvider>
            <div className="space-y-2 p-4">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                  <ScrollText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No activity recorded for this session</p>
                </div>
              ) : (
                timeline.map((event, idx) => (
                  <TimelineEventCard
                    key={`${event.event_type}-${event.entity_id}-${idx}`}
                    event={event}
                    groupData={event.event_type === "group" && event.entity_id ? groupMap.get(event.entity_id) : undefined}
                  />
                ))
              )}
            </div>
          </TooltipProvider>
        </ScrollArea>
      </div>
    </div>
  );
}

function TimelineEventCard({ event, groupData }: { event: TimelineEvent; groupData?: GroupItem }) {
  const eventType = event.event_type || "unknown";
  const config = EVENT_CONFIG[eventType] || EVENT_CONFIG.login!;
  const Icon = config.icon;

  const content = (
    <div className={`flex gap-3 items-start border-l-4 rounded-lg p-3 ${config.borderColor} ${config.bgColor}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent><p>{config.label}</p></TooltipContent>
      </Tooltip>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{config.label}</Badge>

          {eventType === "group" && (
            <span className="text-sm font-medium truncate">
              {event.entity_name || "Unnamed Group"}
            </span>
          )}

          {eventType === "chat" && (
            <span className="text-sm font-medium truncate">
              {event.entity_name || "Unnamed Chat"}
            </span>
          )}

          {eventType === "login" && (
            <span className="text-sm text-muted-foreground">Logged in</span>
          )}

          {eventType === "problem" && (
            <>
              <Badge variant="destructive" className="text-xs">{event.entity_name}</Badge>
              {event.extra_2 === "true" && (
                <Badge variant="secondary" className="text-xs">Resolved</Badge>
              )}
            </>
          )}

          {eventType === "attempt" && (
            <span className="text-sm text-muted-foreground">Attempt started</span>
          )}

          {eventType === "practice" && (
            <span className="text-sm text-muted-foreground">Practice session</span>
          )}
        </div>

        {/* Problem message */}
        {eventType === "problem" && event.extra_1 && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.extra_1}</p>
        )}

        {/* Group run stats */}
        {eventType === "group" && groupData && (
          <>
            <Separator className="my-2" />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Runs: </span>
                <span className="font-semibold">{formatNumber(groupData.run_count)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tokens: </span>
                <span className="font-semibold">{formatNumber(groupData.total_tokens)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cost: </span>
                <span className="font-semibold">{formatCost(groupData.total_cost)}</span>
              </div>
            </div>
          </>
        )}

        {/* Timestamp */}
        {event.created_at && (
          <span className="text-xs text-muted-foreground mt-1 block">
            {formatDate(event.created_at)}
          </span>
        )}
      </div>
    </div>
  );

  // Wrap linkable events
  if (eventType === "group" && event.entity_id) {
    return <Link href={`/group/${event.entity_id}`} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  }
  if (eventType === "chat" && event.entity_id) {
    return <Link href={`/chat/${event.entity_id}`} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  }
  if (eventType === "attempt" && event.entity_id) {
    return <Link href={`/attempt/${event.entity_id}`} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  }
  if (eventType === "practice" && event.entity_id) {
    return <Link href={`/practice/${event.entity_id}`} className="block hover:opacity-90 transition-opacity">{content}</Link>;
  }

  return content;
}
