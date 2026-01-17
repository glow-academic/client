/**
 * Thresholds.tsx
 * Resource component for threshold resources
 * Displays threshold resources and allows generation
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

type CreateDraftThresholdsIn = InputOf<"/api/v4/resources/thresholds", "post">;
type CreateDraftThresholdsOut = OutputOf<
  "/api/v4/resources/thresholds",
  "post"
>;

export interface ThresholdsProps {
  threshold_ids?: string[];
  threshold_resources?: Array<{
    threshold_id: string | null;
    value: number | null;
    generated?: boolean | null;
  }>;
  show_thresholds?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createThresholdsAction?:
    | ((input: CreateDraftThresholdsIn) => Promise<CreateDraftThresholdsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Thresholds({
  threshold_ids,
  threshold_resources,
  show_thresholds = false,
  disabled = false,
  onChange,
  label = "Thresholds",
  id = "thresholds",
  required = false,
  description,
  agent_id,
  onGenerate,
  isGenerating = false,
}: ThresholdsProps) {
  const show = show_thresholds ?? false;
  const hasGenerated = useMemo(() => {
    return threshold_resources?.some((t) => t.generated) ?? false;
  }, [threshold_resources]);

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
      {threshold_resources && threshold_resources.length > 0 && (
        <div className="space-y-1">
          {threshold_resources.map((threshold) => (
            <div
              key={threshold.threshold_id || Math.random()}
              className="text-sm"
            >
              {threshold.value !== null && <span>{threshold.value}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
