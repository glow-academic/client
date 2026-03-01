/**
 * Session.tsx
 * Chat-style timeline showing pricing groups chronologically.
 * @AshokSaravanan222
 * 02/06/2026
 */
"use client";

import type { SessionDetailOut } from "@/app/(main)/session/[sessionId]/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { Layers, ScrollText } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export interface SessionProps {
  sessionDetail: SessionDetailOut;
}

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

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

const formatCost = (cost: string): string => {
  const num = parseFloat(cost);
  if (isNaN(num)) return "$0.000000";
  return `$${num.toFixed(6)}`;
};

export default function Session({
  sessionDetail,
}: SessionProps) {
  const groups = (sessionDetail.groups ?? []) as GroupItem[];

  // Sort groups chronologically
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (!a.first_run_at && !b.first_run_at) return 0;
      if (!a.first_run_at) return -1;
      if (!b.first_run_at) return 1;
      return new Date(a.first_run_at).getTime() - new Date(b.first_run_at).getTime();
    });
  }, [groups]);

  if (!sessionDetail.session_exists) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Session not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      {/* Header card — session metadata */}
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
              <span className="font-medium">
                {sessionDetail.profile_name ?? "Unknown"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="font-medium">
                {sessionDetail.session_created_at
                  ? formatDate(sessionDetail.session_created_at)
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Groups: </span>
              <span className="font-medium">{formatNumber(groups.length)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Session: </span>
              <span className="font-medium font-mono text-xs">
                {sessionDetail.session_id
                  ? sessionDetail.session_id.substring(0, 8) + "..."
                  : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups timeline */}
      <div className="border rounded-lg flex-1 min-h-0 overflow-hidden flex flex-col bg-card">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Timeline</h3>
        </div>
        <ScrollArea className="flex-1 h-[500px]">
          <TooltipProvider>
            <div className="space-y-3 p-4">
              {sortedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground">
                  <ScrollText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">
                    No activity recorded for this session
                  </p>
                </div>
              ) : (
                sortedGroups.map((group) => (
                  <GroupBubble
                    key={`group-${group.group_id}`}
                    group={group}
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

/* ---- Group bubble ---- */
function GroupBubble({ group }: { group: GroupItem }) {
  return (
    <div className="flex gap-3 justify-end">
      <div className="flex flex-col gap-1 max-w-[80%] items-end">
        <Link
          href={`/group/${group.group_id}`}
          className="block"
        >
          <div className="rounded-lg p-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <p className="text-sm font-medium">
              {group.group_name || "Unnamed Group"}
            </p>
            <Separator className="my-2 bg-primary-foreground/20" />
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="opacity-70">Runs</div>
                <div className="font-semibold">
                  {formatNumber(group.run_count)}
                </div>
              </div>
              <div>
                <div className="opacity-70">Tokens</div>
                <div className="font-semibold">
                  {formatNumber(group.total_tokens)}
                </div>
              </div>
              <div>
                <div className="opacity-70">Cost</div>
                <div className="font-semibold">
                  {formatCost(group.total_cost)}
                </div>
              </div>
            </div>
          </div>
        </Link>
        {group.first_run_at && (
          <span className="text-xs text-muted-foreground">
            {formatDate(group.first_run_at)}
          </span>
        )}
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pricing Group</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
