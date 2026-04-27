/**
 * TestChatHeader.tsx
 * Top-left "History" caption + top-right Resources toggle.
 *
 * Multi-select run picker moved to the bottom composer bar
 * (RunSelector) — the picker is now the source of truth for which run
 * configurations get queued on Run, not a filter for the history list.
 * The header is purely a read-only summary of the runs that have
 * already executed for this invocation.
 */
"use client";

import { Button } from "@/components/ui/button";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";
import { FileText, History } from "lucide-react";

interface TestChatHeaderExtraProps {
  /** Number of runs in the history list. */
  history_count?: number;
}

export type TestChatHeaderRunOption = {
  id: string;
  label: string;
  status?: string;
};

export function TestChatHeader(props: ChatHeaderProps & TestChatHeaderExtraProps) {
  const {
    history_count = 0,
    show_documents,
    on_toggle_documents,
    has_documents,
    disabled,
  } = props;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b min-h-[48px]">
      {/* Left: read-only history summary */}
      <div className="flex items-center gap-2 min-w-0">
        <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium">
          {history_count === 0 ? "No runs yet" : `History · ${history_count}`}
        </span>
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
