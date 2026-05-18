/**
 * ModelHistoryView.tsx
 * Historical run-by-run feed scoped to the selected model.
 * Each run is collapsible — expanding shows its message transcript
 * (read from /test/get's entries.messages, filtered by run_id).
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { OutputOf } from "@/lib/api/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Loader2,
  Square,
} from "lucide-react";
import MarkdownInline from "@/components/common/markdown/MarkdownInline";
import { useEffect, useMemo, useRef, useState } from "react";

type TestArtifactOut = OutputOf<"/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];
type MessageItem = NonNullable<
  NonNullable<TestArtifactOut["entries"]>["messages"]
>[number];

export interface ModelHistoryViewProps {
  runs: RunItem[];
  messages: MessageItem[];
  starting_run_ids: Set<string>;
  stopping_run_ids: Set<string>;
  on_stop_run: (invocationId: string) => void;
  is_connected: boolean;
  /** When set, narrows the rendered run list to just the matching run.
   *  Drives the local-switcher view: pick a run, see only its
   *  transcript. Leave unset for the multi-run history overview. */
  selected_run_id?: string | null;
  disabled?: boolean;
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "preview":
      return <Eye className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-500 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Complete
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Running
        </Badge>
      );
    case "preview":
      return (
        <Badge variant="outline" className="text-xs border-dashed">
          <Eye className="h-3 w-3 mr-1" />
          Preview
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not started
        </Badge>
      );
  }
}

function roleColor(role: string): string {
  switch (role) {
    case "assistant":
      return "text-blue-600 dark:text-blue-400";
    case "user":
      return "text-emerald-600 dark:text-emerald-400";
    case "system":
      return "text-muted-foreground";
    case "developer":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

export function ModelHistoryView({
  runs,
  messages,
  starting_run_ids,
  stopping_run_ids,
  on_stop_run,
  is_connected,
  selected_run_id,
  disabled,
}: ModelHistoryViewProps) {
  // Group messages by run_id once per messages prop change.
  const messagesByRun = useMemo<Record<string, MessageItem[]>>(() => {
    const out: Record<string, MessageItem[]> = {};
    for (const m of messages) {
      const key = m.run_id;
      if (!out[key]) out[key] = [];
      out[key]!.push(m);
    }
    for (const key of Object.keys(out)) {
      out[key]!.sort((a, b) =>
        a.message_created_at.localeCompare(b.message_created_at),
      );
    }
    return out;
  }, [messages]);

  // Local-switcher narrowing — when a run is selected upstream, show
  // only its transcript. When unset, fall back to the multi-run history
  // overview (preserves the previous behavior for the picker preview
  // flow). Selection from the header dropdown picks one run; if it
  // doesn't match anything in ``runs`` (e.g. mid-selection state), we
  // also fall back to the full list rather than showing an empty pane.
  const displayedRuns = useMemo(() => {
    if (!selected_run_id) return runs;
    const match = runs.find((r) => r.run_id === selected_run_id);
    return match ? [match] : runs;
  }, [runs, selected_run_id]);

  if (displayedRuns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-8">
        <p className="text-sm">
          Select runs from the top-left to see their history here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      {displayedRuns.map((run) => (
        <RunRow
          key={`${run.chat_id ?? ""}::${run.run_id ?? "none"}`}
          run={run}
          run_messages={
            run.run_id ? messagesByRun[run.run_id] ?? [] : []
          }
          is_starting={
            run.chat_id ? starting_run_ids.has(run.chat_id) : false
          }
          is_stopping={
            run.chat_id ? stopping_run_ids.has(run.chat_id) : false
          }
          on_stop_run={on_stop_run}
          is_connected={is_connected}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface RunRowProps {
  run: RunItem;
  run_messages: MessageItem[];
  is_starting: boolean;
  is_stopping: boolean;
  on_stop_run: (invocationId: string) => void;
  is_connected: boolean;
  disabled?: boolean | undefined;
}

function RunRow({
  run,
  run_messages,
  is_starting,
  is_stopping,
  on_stop_run,
  is_connected,
  disabled,
}: RunRowProps) {
  // Default open so the transcript is visible immediately — collapsing
  // is still available via the chevron for noisy lists.
  const [open, setOpen] = useState(true);
  const status = run.status || "not_started";
  const hasTranscript = run_messages.length > 0;

  // Lazily fetch text content when the row opens. Cache by text_id so re-opens
  // are free, and so successive messages sharing a text don't double-fetch.
  const [textsById, setTextsById] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open || run_messages.length === 0) return;
    const wanted: string[] = [];
    for (const m of run_messages) {
      for (const tid of m.text_ids ?? []) {
        if (!fetchedRef.current.has(tid)) {
          fetchedRef.current.add(tid);
          wanted.push(tid);
        }
      }
    }
    if (wanted.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        wanted.map(async (tid) => {
          try {
            const res = await fetch(`/api/test/text/${tid}`);
            if (!res.ok) return [tid, ""] as const;
            return [tid, await res.text()] as const;
          } catch {
            return [tid, ""] as const;
          }
        }),
      );
      if (cancelled) return;
      setTextsById((prev) => {
        const next = { ...prev };
        for (const [tid, text] of results) next[tid] = text;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, run_messages]);

  const isPreview = status === "preview";
  return (
    <Card
      className={
        isPreview
          ? "border border-dashed border-muted-foreground/40 bg-muted/20"
          : "border"
      }
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
              disabled={!hasTranscript}
            >
              {statusIcon(status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {run.agent_name || "Agent"}
                  </span>
                  {run.run_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {run.run_id.substring(0, 8)}
                    </span>
                  )}
                </div>
                {hasTranscript && (
                  <span className="text-xs text-muted-foreground">
                    {run_messages.length} message
                    {run_messages.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {hasTranscript && (
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
              )}
            </CollapsibleTrigger>

            <div className="flex items-center gap-2 flex-shrink-0">
              {status === "completed" &&
                run.grade_score !== null &&
                run.grade_score !== undefined && (
                  <Badge
                    variant={run.grade_passed ? "default" : "destructive"}
                    className={run.grade_passed ? "bg-green-500" : ""}
                  >
                    {run.grade_score}
                    {run.grade_passed ? " Pass" : " Fail"}
                  </Badge>
                )}
              {statusBadge(status)}
              {is_starting && status === "not_started" && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Starting…
                </Badge>
              )}
              {status === "in_progress" && run.chat_id && (
                <Button
                  onClick={() => on_stop_run(run.chat_id!)}
                  variant="destructive"
                  size="sm"
                  disabled={disabled || !is_connected || is_stopping}
                >
                  {is_stopping ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3 mr-1" />
                  )}
                  {is_stopping ? "Stopping..." : "Stop"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <div className="border-t pt-3 space-y-2">
              {run_messages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No messages recorded for this run.
                </p>
              ) : (
                run_messages.map((m) => {
                  const text = (m.text_ids ?? [])
                    .map((tid) => textsById[tid])
                    .filter(Boolean)
                    .join("\n");
                  const loading = (m.text_ids ?? []).some(
                    (tid) => textsById[tid] === undefined,
                  );
                  return (
                    <div
                      key={m.message_id}
                      className="text-xs flex flex-col gap-0.5 border-l-2 border-muted pl-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold uppercase tracking-wide ${roleColor(m.role)}`}
                        >
                          {m.role}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          {new Date(m.message_created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {(m.text_ids ?? []).length === 0 ? (
                        <span className="text-muted-foreground italic">
                          (no text)
                        </span>
                      ) : text ? (
                        <div className="text-foreground min-w-0 w-full overflow-x-auto [&_pre]:max-w-full [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:break-words">
                          <MarkdownInline>{text}</MarkdownInline>
                        </div>
                      ) : loading ? (
                        <span className="text-muted-foreground italic">
                          Loading…
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          (empty)
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
