/**
 * Feedbacks.tsx
 * Resource component for feedback resources
 * Displays feedback resources and allows generation
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

type CreateDraftFeedbacksIn = InputOf<"/api/v4/resources/feedbacks", "post">;
type CreateDraftFeedbacksOut = OutputOf<"/api/v4/resources/feedbacks", "post">;

export interface FeedbacksProps {
  feedback_ids?: string[];
  feedback_resources?: Array<{
    feedback_id: string | null;
    total: number | null;
    feedback: string | null;
    generated?: boolean | null;
  }>;
  show_feedbacks?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createFeedbacksAction?:
    | ((input: CreateDraftFeedbacksIn) => Promise<CreateDraftFeedbacksOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Feedbacks({
  feedback_ids,
  feedback_resources,
  show_feedbacks = false,
  disabled = false,
  onChange,
  label = "Feedbacks",
  id = "feedbacks",
  required = false,
  description,
  agent_id,
  onGenerate,
  isGenerating = false,
}: FeedbacksProps) {
  const show = show_feedbacks ?? false;
  const hasGenerated = useMemo(() => {
    return feedback_resources?.some((f) => f.generated) ?? false;
  }, [feedback_resources]);

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
      {feedback_resources && feedback_resources.length > 0 && (
        <div className="space-y-1">
          {feedback_resources.map((feedback) => (
            <div
              key={feedback.feedback_id || Math.random()}
              className="text-sm"
            >
              {feedback.total !== null && (
                <span className="font-medium">{feedback.total}</span>
              )}
              {feedback.feedback && (
                <p className="text-muted-foreground">{feedback.feedback}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
