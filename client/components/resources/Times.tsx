/**
 * Times.tsx
 * Resource component for time resources
 * Displays time resources and allows generation
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

type CreateDraftTimesIn = InputOf<"/api/v4/resources/times", "post">;
type CreateDraftTimesOut = OutputOf<"/api/v4/resources/times", "post">;

export interface TimesProps {
  time_ids?: string[]; // Current time resource IDs
  time_resources?: Array<{
    time_id: string | null;
    time_taken: number | null;
    generated?: boolean | null;
  }>;
  show_times?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createTimesAction?:
    | ((input: CreateDraftTimesIn) => Promise<CreateDraftTimesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Times({
  time_ids,
  time_resources,
  show_times = false,
  disabled = false,
  onChange,
  label = "Times",
  id = "times",
  required = false,
  description,
  agent_id,
  onGenerate,
  isGenerating = false,
}: TimesProps) {
  const show = show_times ?? false;
  const hasGenerated = useMemo(() => {
    return time_resources?.some((t) => t.generated) ?? false;
  }, [time_resources]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      {time_resources && time_resources.length > 0 && (
        <div className="space-y-1">
          {time_resources.map((time) => (
            <div key={time.time_id || Math.random()} className="text-sm">
              {time.time_taken !== null && <span>{time.time_taken}s</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
