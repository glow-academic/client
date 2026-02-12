/**
 * RunPositions.tsx
 * Resource component for run position management
 * Displays position values for evals within runs
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface RunPositionsProps {
  run_position_ids?: string[];
  run_position_resources?: Array<{
    id?: string | null;
    runs_id?: string | null;
    eval_id?: string | null;
    value?: number | null;
    generated?: boolean | null;
  }>;
  show_run_positions?: boolean;
  run_positions?: Array<{
    id?: string | null;
    runs_id?: string | null;
    eval_id?: string | null;
    value?: number | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  group_id?: string | null;
  link_tool_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  aiRunPositionResources?: Array<{
    id?: string | null;
    value?: number | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function RunPositions({
  run_position_ids,
  run_position_resources,
  show_run_positions = false,
  run_positions,
  disabled = false,
  onChange,
  label = "Run Positions",
  id = "run-positions",
  required = false,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiRunPositionResources,
  onAccept,
  onReject,
}: RunPositionsProps) {
  const ids = useMemo(
    () => run_position_ids ?? [],
    [run_position_ids]
  );
  const show = show_run_positions ?? false;
  const allPositions = useMemo(
    () => run_positions ?? [],
    [run_positions]
  );

  const showDiff = !!aiRunPositionResources?.length;

  const hasGenerated = useMemo(() => {
    return run_position_resources?.some((r) => r.generated) ?? false;
  }, [run_position_resources]);

  const handleToggle = useCallback(
    (positionId: string) => {
      if (ids.includes(positionId)) {
        onChange(ids.filter((id) => id !== positionId));
      } else {
        onChange([...ids, positionId]);
      }
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    if (!aiRunPositionResources?.length) return;
    const newIds = aiRunPositionResources
      .map((r) => r.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiRunPositionResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {onGenerate && showAiGenerate && (
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
      <div className="space-y-2">
        {allPositions.map((position) => {
          const isSelected = position.id ? ids.includes(position.id) : false;
          return (
            <div
              key={position.id ?? "unknown"}
              className="flex items-center gap-3 p-2 rounded-lg border"
            >
              <Input
                type="number"
                value={position.value ?? ""}
                disabled
                className="w-20"
              />
              <span className="text-sm text-muted-foreground flex-1">
                Position {position.value ?? "?"}
              </span>
              <Button
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => position.id && handleToggle(position.id)}
                disabled={disabled}
              >
                {isSelected ? "Selected" : "Select"}
              </Button>
            </div>
          );
        })}
        {allPositions.length === 0 && (
          <p className="text-sm text-muted-foreground">No run positions available.</p>
        )}
      </div>
    </div>
  );
}
