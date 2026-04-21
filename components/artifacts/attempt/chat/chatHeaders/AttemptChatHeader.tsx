/**
 * AttemptChatHeader.tsx
 * Chat header component with timer, controls, and objectives
 * Explicit, self-contained types (like resource components)
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTime } from "@/utils/time";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  ListChecks,
  Table,
} from "lucide-react";

// Explicit, self-contained prop interface (like resource components)
export interface ChatHeaderProps {
  // Explicit timer type - self-contained
  timer?: {
    elapsed: number;
    remaining: number | null;
    expired: boolean;
    negative?: boolean; // Allows timer to go negative
  };

  // Explicit state props
  show_documents: boolean;
  show_objectives: boolean;
  show_rubric: boolean;
  show_responses?: boolean; // NEW - current toggle state for video responses

  // Whether documents exist (controls if toggle button is shown)
  has_documents?: boolean;

  // Whether video has questions (controls if "View Responses" button is shown)
  has_video_questions?: boolean;

  // Callbacks
  on_toggle_documents: (show: boolean) => void;
  on_toggle_objectives: (show: boolean) => void;
  on_toggle_rubric: (show: boolean) => void;
  on_toggle_responses?: (show: boolean) => void; // NEW - callback for video responses

  // Mobile-only: open the full-screen modal instead of the inline toggle
  // for features that don't fit the mobile viewport (documents sidebar
  // is hidden, objectives Collapsible overlaps problem statement).
  // Rubric stays on the inline toggle since it's just a view-mode swap.
  on_open_documents_modal?: () => void;
  on_open_objectives_modal?: () => void;

  // Explicit objectives type - self-contained
  objectives?: Array<string>;

  // Explicit scenario title type
  scenario_title?: string | null;

  // Explicit attempt type - self-contained
  attempt?: {
    infinite_mode?: boolean | null;
  } | null;

  // Explicit simulation type - self-contained
  simulation?: {
    time_limit?: number | null;
    objectives_enabled?: boolean | null;
  } | null;

  // Explicit dynamic rubric type - self-contained
  current_dynamic_rubric?: {
    chat_id: string;
    score: number;
    total_possible_points: number;
    passed: boolean;
  } | null;

  // Explicit expected chat count
  expected_chat_count?: number;

  // Explicit chats type - self-contained
  chats?: Array<{
    id: string;
    completed?: boolean | null;
  }>;

  // Explicit display chat type
  display_chat?: {
    id: string;
    completed?: boolean | null;
  } | null;

  // Standard props (like resource components)
  disabled?: boolean;
}

export function AttemptChatHeader({
  timer,
  show_documents,
  show_objectives,
  show_rubric,
  show_responses = false,
  has_documents = false,
  has_video_questions = false,
  on_toggle_documents,
  on_toggle_objectives,
  on_toggle_rubric,
  on_toggle_responses,
  on_open_documents_modal,
  on_open_objectives_modal,
  objectives = [],
  scenario_title,
  attempt,
  simulation,
  current_dynamic_rubric,
  expected_chat_count = 1,
  chats = [],
  display_chat,
  disabled = false,
}: ChatHeaderProps) {
  const isMobile = useIsMobile();
  const isInfiniteMode = attempt?.infinite_mode ?? false;
  const _hasTimeLimit = Boolean(simulation?.time_limit);
  const timeRemaining = timer?.remaining ?? null;

  const shouldShowObjectives =
    simulation?.objectives_enabled && objectives.length > 0;
  const hasDocuments = has_documents; // Show toggle button if documents exist

  return (
    <Collapsible
      open={show_objectives}
      onOpenChange={on_toggle_objectives}
      className="border-b"
    >
      {/* Header layout:
          Desktop (md+): single row — scenario on the left (flex-1),
                         icon controls + timer grouped on the right.
                         Matches v1 production density.
          Mobile: two rows — controls+timer on top, scenario below. */}
      <div className="p-2 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-start gap-3 py-2 md:py-0">
        {/* Controls row (mobile) / right group (desktop): on mobile this
            stretches full-width with icons left + timer right via
            justify-between; on desktop it shrinks to hug its contents
            so the scenario can take the remaining space. */}
        <div className="order-1 md:order-2 flex items-center justify-between md:justify-end gap-3 md:flex-shrink-0">
          {/* Icon controls (objectives, responses, rubric, documents) */}
          <div className="flex items-center gap-2">
            {shouldShowObjectives && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {isMobile && on_open_objectives_modal ? (
                    // Mobile: open the objectives modal. The inline
                    // Collapsible overlaps the problem statement on
                    // narrow viewports, so mobile uses a dedicated
                    // full-screen dialog.
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={on_open_objectives_modal}
                      className="p-2"
                      disabled={disabled}
                    >
                      <ListChecks className="h-4 w-4" />
                    </Button>
                  ) : (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant={show_objectives ? "default" : "outline"}
                        size="sm"
                        className={`p-2 ${show_objectives ? "bg-primary text-primary-foreground" : ""}`}
                        disabled={disabled}
                      >
                        <ListChecks className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{show_objectives ? "Hide Objectives" : "Show Objectives"}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {display_chat?.completed && has_video_questions && on_toggle_responses && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={show_responses ? "default" : "outline"}
                    size="sm"
                    onClick={() => on_toggle_responses(!show_responses)}
                    className={`p-2 ${show_responses ? "bg-primary text-primary-foreground" : ""}`}
                    disabled={disabled}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{show_responses ? "Hide Responses" : "View Responses"}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {display_chat?.completed && !has_video_questions && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={show_rubric ? "default" : "outline"}
                    size="sm"
                    onClick={() => on_toggle_rubric(!show_rubric)}
                    className={`p-2 ${show_rubric ? "bg-primary text-primary-foreground" : ""}`}
                    disabled={disabled}
                  >
                    <Table className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{show_rubric ? "Hide Rubric" : "Show Rubric"}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {hasDocuments && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={show_documents ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isMobile && on_open_documents_modal) {
                        on_open_documents_modal();
                      } else {
                        on_toggle_documents(!show_documents);
                      }
                    }}
                    className={`p-2 ${show_documents ? "bg-primary text-primary-foreground" : ""}`}
                    disabled={disabled}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{show_documents ? "Hide Documents" : "Show Documents"}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Completed badge + timer pill */}
          <div className="flex items-center gap-2">
            {!attempt?.infinite_mode &&
              display_chat?.completed &&
              !current_dynamic_rubric &&
              expected_chat_count ===
                chats.filter((chat) => chat?.completed).length && (
                <Badge variant="default">Completed</Badge>
              )}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center justify-center gap-2 px-3 py-1 rounded-full ${
                    !attempt?.infinite_mode &&
                    display_chat?.completed &&
                    current_dynamic_rubric &&
                    expected_chat_count ===
                      chats.filter((chat) => chat?.completed).length
                      ? current_dynamic_rubric?.passed
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                      : "bg-muted"
                  }`}
                >
                  {isInfiniteMode ? (
                    <InfinityIcon className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      attempt?.infinite_mode
                        ? ""
                        : simulation?.time_limit &&
                            timer?.remaining !== null &&
                            timer.remaining < 0
                          ? "text-red-500"
                          : ""
                    }`}
                    data-testid="timer"
                  >
                    {isInfiniteMode
                      ? simulation?.time_limit
                        ? formatTime(timer?.negative ? (timeRemaining ?? 0) : Math.max(timeRemaining || 0, 0))
                        : formatTime(timer?.elapsed ?? 0)
                      : simulation?.time_limit && timer?.remaining !== null
                        ? formatTime(timer.remaining)
                        : formatTime(timer?.elapsed ?? 0)}
                  </span>
                </div>
              </TooltipTrigger>
              {!attempt?.infinite_mode &&
                display_chat?.completed &&
                current_dynamic_rubric &&
                expected_chat_count ===
                  chats.filter((chat) => chat?.completed).length && (
                  <TooltipContent>
                    <p>
                      {current_dynamic_rubric.passed ? "Passed" : "Failed"} (
                      {current_dynamic_rubric?.score}/
                      {current_dynamic_rubric?.total_possible_points})
                    </p>
                  </TooltipContent>
                )}
            </Tooltip>
          </div>
        </div>

        {/* Scenario description as natural prose — no clamp.
            Desktop: sits on the left (order-1, flex-1) beside the icons.
            Mobile: drops to its own row (order-2) below the controls. */}
        {scenario_title && (
          <div className="order-2 md:order-1 md:flex-1 text-sm md:text-base text-left">
            <span className="font-medium">{scenario_title}</span>
          </div>
        )}
      </div>
      </div>

      {/* Objectives Collapsible Content */}
      {shouldShowObjectives && (
        <CollapsibleContent className="pt-2">
          <div className="px-4 pb-2">
            <ul className="space-y-2 list-none">
              {objectives.map((objective, index) => (
                <li key={index} className="font-normal flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="flex-1 -mt-0.5">{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
