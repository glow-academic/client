/**
 * TestChatHeader.tsx
 * Multi-select run picker (top-left) + resource panel toggle (top-right).
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatHeaderProps } from "@/components/artifacts/attempt/chat/chatHeaders/AttemptChatHeader";
import { CheckCircle2, ChevronDown, Clock, FileText, Layers } from "lucide-react";

export interface TestChatHeaderRunOption {
  id: string;
  label: string;
  status?: string;
}

interface TestChatHeaderExtraProps {
  runs?: TestChatHeaderRunOption[];
  selected_run_ids?: string[];
  on_select_runs?: (ids: string[]) => void;
}

function statusDot(status?: string) {
  if (status === "completed")
    return <CheckCircle2 className="h-3 w-3 text-green-500" />;
  if (status === "in_progress")
    return <Clock className="h-3 w-3 text-blue-500" />;
  return null;
}

export function TestChatHeader(props: ChatHeaderProps & TestChatHeaderExtraProps) {
  const {
    runs = [],
    selected_run_ids = [],
    on_select_runs,
    show_documents,
    on_toggle_documents,
    has_documents,
    disabled,
  } = props;

  const allIds = runs.map((r) => r.id);
  const selectedSet = new Set(selected_run_ids);
  const selectedCount = selected_run_ids.length;
  const totalCount = runs.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const noneSelected = selectedCount === 0;

  const toggle = (id: string) => {
    if (!on_select_runs) return;
    on_select_runs(
      selectedSet.has(id)
        ? selected_run_ids.filter((x) => x !== id)
        : [...selected_run_ids, id],
    );
  };

  const selectAll = () => on_select_runs?.(allIds);
  const clearAll = () => on_select_runs?.([]);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b min-h-[48px]">
      {/* Left: multi-select run picker */}
      <div className="flex items-center gap-2 min-w-0">
        <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              disabled={disabled || totalCount === 0}
            >
              <span className="text-sm font-medium">
                {totalCount === 0
                  ? "No runs"
                  : noneSelected
                    ? "Select runs"
                    : allSelected
                      ? `All ${totalCount} runs`
                      : `${selectedCount} of ${totalCount} runs`}
              </span>
              {selectedCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {selectedCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[300px] p-0"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-medium">
                {selectedCount} selected
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={selectAll}
                  disabled={allSelected}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={clearAll}
                  disabled={noneSelected}
                >
                  None
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-[320px]">
              <div className="p-1">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left"
                  >
                    <Checkbox
                      checked={selectedSet.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="flex-1 text-sm truncate">{r.label}</span>
                    {statusDot(r.status)}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
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
