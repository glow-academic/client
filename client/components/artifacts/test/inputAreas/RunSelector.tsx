/**
 * RunSelector.tsx
 * Run/group dropdown + Run All button — plugs into the input_area slot of GenericChatInterface.
 * Implements TextInputProps interface shape for type compatibility.
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OutputOf } from "@/lib/api/types";
import { Loader2, Play } from "lucide-react";
import { useState } from "react";

type TestArtifactOut = OutputOf<"/api/v5/artifacts/test/get", "post">;
type RunItem = NonNullable<TestArtifactOut["runs"]>[number];

export interface RunSelectorProps {
  runs: RunItem[];
  starting_run_ids: Set<string>;
  on_start_run: (invocationId: string) => void;
  on_start_all: () => void;
  is_connected: boolean;
  disabled?: boolean;
}

export function RunSelector({
  runs,
  starting_run_ids,
  on_start_run,
  on_start_all,
  is_connected,
  disabled,
}: RunSelectorProps) {
  const [selectedRunChatId, setSelectedRunChatId] = useState<string | null>(null);

  const runnableRuns = runs.filter((r) => r.status === "not_started" && r.chat_id);
  const hasAnyRunnable = runnableRuns.length > 0;
  const isAnyStarting = starting_run_ids.size > 0;

  const handleRunSelected = () => {
    if (selectedRunChatId) {
      on_start_run(selectedRunChatId);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t bg-card">
      {/* Run selector dropdown */}
      <Select
        value={selectedRunChatId ?? ""}
        onValueChange={(val) => setSelectedRunChatId(val || null)}
        disabled={disabled || !hasAnyRunnable}
      >
        <SelectTrigger className="flex-1 h-9">
          <SelectValue placeholder="Select a run..." />
        </SelectTrigger>
        <SelectContent>
          {runnableRuns.map((run) => (
            <SelectItem key={run.chat_id} value={run.chat_id!}>
              {run.agent_name || "Agent"} — {run.model_name || "No model"}
              {run.group_id ? ` (Group)` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Run selected */}
      <Button
        onClick={handleRunSelected}
        size="sm"
        disabled={
          disabled ||
          !is_connected ||
          !selectedRunChatId ||
          starting_run_ids.has(selectedRunChatId)
        }
      >
        {selectedRunChatId && starting_run_ids.has(selectedRunChatId) ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Play className="h-3 w-3 mr-1" />
        )}
        Run
      </Button>

      {/* Run All */}
      <Button
        onClick={on_start_all}
        variant="outline"
        size="sm"
        disabled={disabled || !is_connected || !hasAnyRunnable || isAnyStarting}
      >
        {isAnyStarting ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Play className="h-3 w-3 mr-1" />
        )}
        Run All
      </Button>
    </div>
  );
}
