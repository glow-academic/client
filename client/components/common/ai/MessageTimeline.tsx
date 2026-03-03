"use client";

import { Button } from "@/components/ui/button";
import type { GroupMessage } from "@/hooks/use-generation-panel";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MessageTimelineProps {
  messages: GroupMessage[];
  totalCount: number;
  isLoading: boolean;
  onLoadMore: () => void;
}

/** Fetch text content for a single upload ID via the download proxy. */
async function fetchTextContent(uploadId: string): Promise<string> {
  const res = await fetch(`/api/uploads/${uploadId}/download`);
  if (!res.ok) return "";
  return res.text();
}

/** Hook: resolve text_upload_ids → displayable strings for each message. */
function useTextContents(messages: GroupMessage[]) {
  const [contentMap, setContentMap] = useState<Record<string, string[]>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toFetch: { messageId: string; uploadIds: string[] }[] = [];

    for (const msg of messages) {
      const mid = msg.message_id;
      if (!mid || fetchedRef.current.has(mid)) continue;
      const ids = msg.text_upload_ids;
      if (!ids || ids.length === 0) continue;
      toFetch.push({ messageId: mid, uploadIds: ids });
      fetchedRef.current.add(mid);
    }

    if (toFetch.length === 0) return;

    for (const { messageId, uploadIds } of toFetch) {
      Promise.all(uploadIds.map(fetchTextContent)).then((texts) => {
        setContentMap((prev) => ({ ...prev, [messageId]: texts }));
      });
    }
  }, [messages]);

  return contentMap;
}

export function MessageTimeline({
  messages,
  totalCount,
  isLoading,
  onLoadMore,
}: MessageTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const textContents = useTextContents(messages);

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
        const texts = msg.message_id
          ? textContents[msg.message_id]
          : undefined;
        const content = texts?.join("\n") ?? "";
        const isLoadingContent =
          !texts && (msg.text_upload_ids?.length ?? 0) > 0;
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
              {isLoadingContent ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <p className="whitespace-pre-wrap break-words">{content}</p>
              )}
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
