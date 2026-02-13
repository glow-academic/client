/**
 * RunPositions.tsx
 * Resource component for run position selection
 * Uses SelectableGrid to display run positions as horizontal scrollable cards
 * Manages run_position_ids array and reports to parent
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
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type RunPositionsGetResponse = OutputOf<"/api/v4/resources/run_positions/get", "post">;
export type RunPositionsResourceItem = NonNullable<RunPositionsGetResponse["items"]>[number];

export interface RunPositionItem {
  id: string;
  runs_id: string;
  eval_id: string;
  value: number | null;
}

export interface RunPositionsProps {
  run_position_ids?: string[];
  run_position_resources?: RunPositionsResourceItem[];
  show_run_positions?: boolean;
  run_position_suggestions?: string[];
  run_positions?: RunPositionsResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  // AI diff props
  aiRunPositionResources?: Pick<RunPositionsResourceItem, "id" | "value">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function RunPositions({
  run_position_ids,
  run_position_resources: _run_position_resources,
  show_run_positions = false,
  run_position_suggestions,
  run_positions,
  disabled = false,
  onChange,
  label = "Run Positions",
  // AI diff props
  aiRunPositionResources,
  onAccept,
  onReject,
}: RunPositionsProps) {
  const ids = useMemo(
    () => run_position_ids ?? [],
    [run_position_ids]
  );
  const show = show_run_positions ?? false;
  const allItems = useMemo(
    () => run_positions ?? [],
    [run_positions]
  );
  const suggestionsList = useMemo(
    () => run_position_suggestions ?? [],
    [run_position_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiRunPositionResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRunPositionResources
          ?.map((r) => r.id)
          .filter(Boolean) as string[]
      ),
    [aiRunPositionResources]
  );

  // Convert to items format for SelectableGrid
  const items = useMemo(() => {
    return allItems
      .filter((r) => r.id)
      .map((r) => ({
        id: r.id!,
        runs_id: r.runs_id ?? "",
        eval_id: r.eval_id ?? "",
        value: r.value ?? null,
      }));
  }, [allItems]);

  const isSuggested = useCallback(
    (itemId: string) => suggestionsList.includes(itemId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept AI suggestion
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

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
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

      <SelectableGrid<RunPositionItem>
        items={items}
        selectedId={null}
        selectedIds={ids}
        onSelect={(itemId) => {
          const newIds = ids.includes(itemId)
            ? ids.filter((id) => id !== itemId)
            : [...ids, itemId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested &&
                  !isSelected &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}
              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium">
                  Position {item.value ?? "\u2014"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {item.runs_id
                    ? `Run: ${item.runs_id.slice(0, 8)}...`
                    : ""}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No run positions available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
