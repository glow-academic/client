"use client";

import { Button } from "@/components/ui/button";
import type { GroupMessage } from "@/hooks/use-generation-panel";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface MessageTimelineProps {
  messages: GroupMessage[];
  totalCount: number;
  isLoading: boolean;
  onLoadMore: () => void;
}

export function MessageTimeline({
  messages,
  totalCount,
  isLoading,
  onLoadMore,
}: MessageTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  const hasMore = messages.length < totalCount;

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      {hasMore && (
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}

      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        const content = msg.contents?.join("\n") ?? "";
        const time = msg.message_created_at
          ? new Date(msg.message_created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        return (
          <div
            key={msg.message_id ?? i}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                isUser
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{content}</p>
              {time && (
                <p className="mt-1 text-[10px] text-muted-foreground">{time}</p>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && messages.length === 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
