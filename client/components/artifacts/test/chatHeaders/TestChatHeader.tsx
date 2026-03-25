/**
 * TestChatHeader.tsx
 * Status bar + resource panel toggle for the test chat interface.
 * Implements ChatHeaderProps from GenericChatInterface.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";

interface TestStatusSummary {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
}

interface TestChatHeaderExtraProps {
  eval_name?: string | null;
  status_summary?: TestStatusSummary | null;
}

/**
 * TestChatHeader renders as a ChatHeaderProps-compatible component.
 * Extra test-specific data is threaded through the `scenario_title` and
 * `timer` fields of ChatHeaderProps to stay type-compatible, but we also
 * accept extra props via intersection.
 */
export function TestChatHeader(props: ChatHeaderProps & TestChatHeaderExtraProps) {
  const {
    eval_name,
    status_summary,
    show_documents,
    on_toggle_documents,
    has_documents,
    disabled,
  } = props;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b min-h-[48px]">
      {/* Left: eval name */}
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-sm font-semibold truncate">
          {eval_name ?? "Evaluation"}
        </h2>

        {/* Status summary badges */}
        {status_summary && (
          <div className="flex items-center gap-2">
            {status_summary.completed > 0 && (
              <Badge variant="default" className="bg-green-500 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {status_summary.completed}
              </Badge>
            )}
            {status_summary.in_progress > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {status_summary.in_progress}
              </Badge>
            )}
            {status_summary.not_started > 0 && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {status_summary.not_started}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right: resource panel toggle */}
      <div className="flex items-center gap-1">
        {has_documents && (
          <Button
            variant={show_documents ? "secondary" : "ghost"}
            size="sm"
            onClick={() => on_toggle_documents(!show_documents)}
            disabled={disabled}
          >
            <FileText className="h-4 w-4 mr-1" />
            Resources
          </Button>
        )}
      </div>
    </div>
  );
}
