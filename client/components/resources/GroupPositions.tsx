/**
 * GroupPositions.tsx
 * Resource component for group position management
 * Displays position values for evals within groups
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

export interface GroupPositionsProps {
  group_position_ids?: string[];
  group_position_resources?: Array<{
    id?: string | null;
    groups_id?: string | null;
    eval_id?: string | null;
    value?: number | null;
    generated?: boolean | null;
  }>;
  show_group_positions?: boolean;
  group_positions?: Array<{
    id?: string | null;
    groups_id?: string | null;
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
  aiGroupPositionResources?: Array<{
    id?: string | null;
    value?: number | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function GroupPositions({
  group_position_ids,
  group_position_resources,
  show_group_positions = false,
  group_positions,
  disabled = false,
  onChange,
  label = "Group Positions",
  id = "group-positions",
  required = false,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiGroupPositionResources,
  onAccept,
  onReject,
}: GroupPositionsProps) {
  const ids = useMemo(
    () => group_position_ids ?? [],
    [group_position_ids]
  );
  const show = show_group_positions ?? false;
  const allPositions = useMemo(
    () => group_positions ?? [],
    [group_positions]
  );

  const showDiff = !!aiGroupPositionResources?.length;

  const hasGenerated = useMemo(() => {
    return group_position_resources?.some((r) => r.generated) ?? false;
  }, [group_position_resources]);

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
    if (!aiGroupPositionResources?.length) return;
    const newIds = aiGroupPositionResources
      .map((r) => r.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiGroupPositionResources, ids, onChange, onAccept]);

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
          <p className="text-sm text-muted-foreground">No group positions available.</p>
        )}
      </div>
    </div>
  );
}
