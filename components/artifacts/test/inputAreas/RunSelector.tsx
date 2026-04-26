/**
 * RunSelector.tsx
 * Bottom input bar for the test chat — free-form textarea + Run button.
 * Pressing Run fans out to the parent's selected_run_ids set; the textarea
 * value is treated as one-shot extra instructions for the next press.
 */
"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play } from "lucide-react";
import { useCallback, useState } from "react";

export interface RunSelectorProps {
  /** True while at least one of the selected runs is starting. */
  is_starting: boolean;
  /** Whether the parent has any selected runs to fire on. */
  has_selection: boolean;
  on_run: (extra_instructions: string) => void;
  is_connected: boolean;
  disabled?: boolean;
}

export function RunSelector({
  is_starting,
  has_selection,
  on_run,
  is_connected,
  disabled,
}: RunSelectorProps) {
  const [text, setText] = useState("");

  const handleRun = useCallback(() => {
    on_run(text);
    setText("");
  }, [on_run, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (!disabled && is_connected && has_selection && !is_starting) {
          handleRun();
        }
      }
    },
    [disabled, is_connected, has_selection, is_starting, handleRun],
  );

  const runDisabled =
    disabled || !is_connected || !has_selection || is_starting;

  return (
    <div className="flex items-end gap-2 px-4 py-2 border-t bg-card">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          has_selection
            ? "Optional extra instructions for this run… (Cmd/Ctrl+Enter to run)"
            : "Pick at least one run from the top-left to begin."
        }
        disabled={disabled || !has_selection}
        className="min-h-[44px] max-h-[140px] text-sm resize-none flex-1"
      />
      <Button
        onClick={handleRun}
        size="sm"
        disabled={runDisabled}
        className="h-[44px]"
      >
        {is_starting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-3 w-3 mr-1" />
            Run
          </>
        )}
      </Button>
    </div>
  );
}
