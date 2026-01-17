/**
 * Analyses.tsx
 * Resource component for analysis resources
 * Displays analysis resources and allows generation
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

type CreateDraftAnalysesIn = InputOf<"/api/v4/resources/analyses", "post">;
type CreateDraftAnalysesOut = OutputOf<"/api/v4/resources/analyses", "post">;

export interface AnalysesProps {
  analysis_ids?: string[];
  analysis_resources?: Array<{
    analysis_id: string | null;
    content: string | null;
    generated?: boolean | null;
  }>;
  show_analyses?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createAnalysesAction?:
    | ((input: CreateDraftAnalysesIn) => Promise<CreateDraftAnalysesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Analyses({
  analysis_ids,
  analysis_resources,
  show_analyses = false,
  disabled = false,
  onChange,
  label = "Analyses",
  id = "analyses",
  required = false,
  description,
  agent_id,
  onGenerate,
  isGenerating = false,
}: AnalysesProps) {
  const show = show_analyses ?? false;
  const hasGenerated = useMemo(() => {
    return analysis_resources?.some((a) => a.generated) ?? false;
  }, [analysis_resources]);

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
      {analysis_resources && analysis_resources.length > 0 && (
        <div className="space-y-1">
          {analysis_resources.map((analysis) => (
            <div
              key={analysis.analysis_id || Math.random()}
              className="text-sm"
            >
              {analysis.content && <p>{analysis.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
