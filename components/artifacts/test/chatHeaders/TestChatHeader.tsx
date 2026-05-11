/**
 * TestChatHeader.tsx
 *
 * Two-axis selection header for the benchmark graded view:
 *   • Global: invocation picker (config under test). Always rendered
 *     when ``invocations`` has ≥1 entry.
 *   • Local: run picker (which execution of that config to view).
 *     Hidden when the selected invocation has ≤1 run — so single-run
 *     benchmarks read identically to AttemptChat.
 *
 * The header is presentational only — selection state and the source
 * data live in TestChat (lifted), nuqs-backed via ``?invocationId`` /
 * ``?runId``. This component just renders the dropdowns and fires
 * callbacks.
 *
 * Right side keeps the Resources toggle so the existing
 * ``ChatHeaderProps`` contract from AttemptChatHeader still works.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";
import { FileText, Layers, MessagesSquare, Table } from "lucide-react";

export type TestChatHeaderRunOption = {
  id: string;
  label: string;
  status?: string;
};

/** One invocation row for the global switcher. */
export type TestChatHeaderInvocationOption = {
  id: string;
  title: string;
  /** Optional secondary label (e.g. agent name / model name) rendered
   *  below the title in the dropdown row. */
  subtitle?: string | null;
};

/** One run row for the local switcher within an invocation. */
export type TestChatHeaderRunDetailOption = {
  id: string;
  score?: number | null;
  passed?: boolean | null;
  /** ISO timestamp — drives the "Run 2 · 5/10" caption. */
  created_at?: string | null;
};

interface TestChatHeaderExtraProps {
  /** Number of runs in the history list. Kept for callers that haven't
   *  migrated to ``invocations`` yet — rendered as a small caption
   *  when no invocation switcher is wired. */
  history_count?: number;

  /** Global axis: every invocation in this test. */
  invocations?: TestChatHeaderInvocationOption[];
  selected_invocation_id?: string | null;
  on_select_invocation?: (id: string) => void;

  /** Local axis: runs within the selected invocation. */
  runs?: TestChatHeaderRunDetailOption[];
  selected_run_id?: string | null;
  on_select_run?: (id: string) => void;

  /** Chat area view mode toggle — mirrors AttemptChat's rubric/docs
   *  icon toggles. When wired, an icon button next to Resources flips
   *  between transcript ("messages") and rubric matrix ("rubric"). */
  view_mode?: "messages" | "rubric";
  on_toggle_view_mode?: (mode: "messages" | "rubric") => void;
}

/** Compact label for a run option — "Run N · MM/DD" + optional score chip. */
function formatRunLabel(
  run: TestChatHeaderRunDetailOption,
  index: number,
  total: number,
): string {
  const ordinal = `Run ${index + 1}${total > 1 ? ` of ${total}` : ""}`;
  if (!run.created_at) return ordinal;
  try {
    const d = new Date(run.created_at);
    if (Number.isNaN(d.getTime())) return ordinal;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${ordinal} · ${mm}/${dd}`;
  } catch {
    return ordinal;
  }
}

export function TestChatHeader(props: ChatHeaderProps & TestChatHeaderExtraProps) {
  const {
    history_count = 0,
    show_documents,
    on_toggle_documents,
    has_documents,
    disabled,
    invocations = [],
    selected_invocation_id,
    on_select_invocation,
    runs = [],
    selected_run_id,
    on_select_run,
    view_mode,
    on_toggle_view_mode,
  } = props;

  const hasInvocationSwitcher = invocations.length > 0 && !!on_select_invocation;
  const showRunSwitcher = runs.length > 1 && !!on_select_run;

  const selectedRun = runs.find((r) => r.id === selected_run_id);
  const selectedRunIndex = runs.findIndex((r) => r.id === selected_run_id);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b min-h-[48px]">
      {/* Left: invocation switcher (global) + run switcher (local) */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {hasInvocationSwitcher ? (
          <Select
            {...(selected_invocation_id != null && {
              value: selected_invocation_id,
            })}
            onValueChange={on_select_invocation}
            {...(disabled != null && { disabled })}
          >
            <SelectTrigger
              className="h-8 max-w-[280px] min-w-[140px] text-sm"
              aria-label="Invocation"
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />
              <SelectValue placeholder="Select invocation" />
            </SelectTrigger>
            <SelectContent>
              {invocations.map((inv) => (
                <SelectItem key={inv.id} value={inv.id} className="text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium truncate">{inv.title}</span>
                    {inv.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {inv.subtitle}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Legacy caption when no invocations wired yet — preserves
          // pre-switcher behavior for callers still on the old shape.
          <span className="text-sm font-medium text-muted-foreground">
            {history_count === 0 ? "No runs yet" : `History · ${history_count}`}
          </span>
        )}

        {showRunSwitcher && (
          <>
            <span className="text-xs text-muted-foreground select-none">/</span>
            <Select
              {...(selected_run_id != null && { value: selected_run_id })}
              onValueChange={on_select_run}
              {...(disabled != null && { disabled })}
            >
              <SelectTrigger
                className="h-8 max-w-[200px] min-w-[120px] text-sm"
                aria-label="Run"
              >
                <SelectValue
                  placeholder={
                    selectedRun
                      ? formatRunLabel(
                          selectedRun,
                          selectedRunIndex,
                          runs.length,
                        )
                      : "Select run"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {runs.map((run, i) => {
                  const label = formatRunLabel(run, i, runs.length);
                  const hasScore =
                    typeof run.score === "number" && Number.isFinite(run.score);
                  const passed = run.passed === true;
                  const failed = run.passed === false;
                  return (
                    <SelectItem key={run.id} value={run.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{label}</span>
                        {hasScore && (
                          <Badge
                            variant="outline"
                            className={
                              passed
                                ? "bg-success/10 text-success border-success/30"
                                : failed
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : ""
                            }
                          >
                            {run.score}%
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Right: icon-only toggle cluster. Mirrors AttemptChatHeader's
          rubric/documents control group — every action is an icon
          button with a Tooltip label so the cluster stays compact and
          consistent across the two chat headers. */}
      <div className="flex items-center gap-2">
        {on_toggle_view_mode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={view_mode === "rubric" ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  on_toggle_view_mode(
                    view_mode === "rubric" ? "messages" : "rubric",
                  )
                }
                className={`p-2 ${view_mode === "rubric" ? "bg-primary text-primary-foreground" : ""}`}
                {...(disabled != null && { disabled })}
                aria-label={view_mode === "rubric" ? "Show messages" : "Show rubric"}
              >
                {view_mode === "rubric" ? (
                  <MessagesSquare className="h-4 w-4" />
                ) : (
                  <Table className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{view_mode === "rubric" ? "Show messages" : "Show rubric"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {has_documents && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={show_documents ? "default" : "outline"}
                size="sm"
                onClick={() => on_toggle_documents(!show_documents)}
                className={`p-2 ${show_documents ? "bg-primary text-primary-foreground" : ""}`}
                {...(disabled != null && { disabled })}
                aria-label={show_documents ? "Hide resources" : "Show resources"}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{show_documents ? "Hide Resources" : "Show Resources"}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
