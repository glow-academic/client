/**
 * ReasoningLevels.tsx
 * Single-select reasoning level picker. Card grid (SelectableGrid horizontal)
 * with click-to-toggle, suggested dot, pending badge, and accept/reject —
 * mirrors Providers.tsx.
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ReasoningLevelResourceItem {
  id?: string | null;
  reasoning_level?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

interface ReasoningLevelGridItem {
  id: string;
  name: string;
}

export interface ReasoningLevelsProps {
  reasoning_level_id?: string | null;
  reasoning_level_resource?: ReasoningLevelResourceItem | null;
  show_reasoning_levels?: boolean;
  reasoning_levels?: ReasoningLevelResourceItem[];
  disabled?: boolean;
  onReasoningLevelIdChange: (reasoningLevelId: string | null) => void;
  label?: string;
  required?: boolean;
  id?: string;
  helpText?: string;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ReasoningLevels({
  reasoning_level_id,
  reasoning_level_resource: _reasoning_level_resource,
  show_reasoning_levels = true,
  reasoning_levels,
  disabled = false,
  onReasoningLevelIdChange,
  label = "Reasoning Level",
  required = false,
  id = "reasoning_level",
  helpText,
}: ReasoningLevelsProps) {
  const resourceId = reasoning_level_id ?? null;
  const show = show_reasoning_levels ?? true;
  const allLevels = useMemo(() => reasoning_levels ?? [], [reasoning_levels]);

  const pendingItems = useMemo(
    () => allLevels.filter((rl) => rl.pending && rl.id),
    [allLevels],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((rl) => rl.id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const items = useMemo<ReasoningLevelGridItem[]>(
    () =>
      allLevels
        .filter((rl) => rl.id && rl.reasoning_level)
        .map((rl) => ({ id: rl.id!, name: titleCase(rl.reasoning_level!) })),
    [allLevels],
  );

  const isSuggested = useCallback(
    (levelId: string) => {
      const rl = allLevels.find((x) => x.id === levelId);
      return rl?.suggested === true;
    },
    [allLevels],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      onReasoningLevelIdChange(itemId === resourceId ? null : itemId);
    },
    [resourceId, onReasoningLevelIdChange],
  );

  const handleAccept = useCallback(() => {
    // Pending item is already selected — next save persists it.
  }, []);

  const handleReject = useCallback(() => {
    if (resourceId && pendingIds.has(resourceId)) {
      onReasoningLevelIdChange(null);
    }
  }, [resourceId, pendingIds, onReasoningLevelIdChange]);

  if (!show) return null;

  return (
    <div className="space-y-3 min-w-0 w-full">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
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

      <SelectableGrid<ReasoningLevelGridItem>
        horizontal
        items={items}
        selectedId={resourceId}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[72px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex flex-col justify-center flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">{item.name}</span>
              </div>
            </div>
          );
        }}
        emptyMessage="No reasoning levels available."
        disabled={disabled}
      />
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
