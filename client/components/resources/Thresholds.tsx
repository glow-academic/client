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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

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
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isGenerating?: boolean;
  // AI diff view props
  aiThresholdResources?: Array<{
    threshold_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  link_tool_id,
  onGenerate,
  showAiGenerate = false,
  isGenerating = false,
  // AI diff view props
  aiThresholdResources,
  onAccept,
  onReject,
}: ThresholdsProps) {
  const show = show_thresholds ?? false;
  const ids = useMemo(() => threshold_ids ?? [], [threshold_ids]);

  // AI suggestion state
  const showDiff = !!aiThresholdResources?.length;
  const _aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiThresholdResources
          ?.map((t) => t.threshold_id)
          .filter(Boolean) as string[]
      ),
    [aiThresholdResources]
  );
  // Note: _aiSuggestedIds available for future use in highlighting suggested items

  // Accept AI suggestion - add AI-suggested thresholds to selection
  const handleAccept = useCallback(() => {
    if (!aiThresholdResources?.length) return;
    const newIds = aiThresholdResources
      .map((t) => t.threshold_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiThresholdResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && showAiGenerate && link_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
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
