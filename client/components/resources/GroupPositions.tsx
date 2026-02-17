/**
 * GroupPositions.tsx
 * Resource component for group position selection
 * Uses SelectableGrid to display group positions as horizontal scrollable cards
 * Manages group_position_ids array and reports to parent
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
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type FlushResult = { group_positions_id: string | null } | void;

type CreateDraftGroupPositionsIn = InputOf<"/api/v4/resources/group_positions", "post">;
type CreateDraftGroupPositionsOut = OutputOf<"/api/v4/resources/group_positions", "post">;

// Derive resource item type from the GET endpoint response
type GroupPositionsGetResponse = OutputOf<"/api/v4/resources/group_positions/get", "post">;
export type GroupPositionResourceItem = NonNullable<GroupPositionsGetResponse["items"]>[number];

export interface GroupPositionItem {
  id: string;
  groups_id: string;
  eval_id: string;
  value: number | null;
}

export interface GroupPositionsProps {
  group_position_ids?: string[];
  group_position_resources?: GroupPositionResourceItem[];
  show_group_positions?: boolean;
  group_position_suggestions?: string[];
  group_positions?: GroupPositionResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  group_id?: string | null;
  create_tool_id?: string | null;
  createGroupPositionsAction?:
    | ((input: CreateDraftGroupPositionsIn) => Promise<CreateDraftGroupPositionsOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  // AI diff props (deprecated - now handled by useResourceAi hook)
  aiGroupPositionResources?: Pick<GroupPositionResourceItem, "id" | "value">[] | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
}

export function GroupPositions({
  group_position_ids,
  group_position_resources,
  show_group_positions = false,
  group_position_suggestions,
  group_positions,
  disabled = false,
  onChange,
  label = "Group Positions",
  group_id,
  create_tool_id: _create_tool_id,
  createGroupPositionsAction: _createGroupPositionsAction,
  isAutosaveEnabled: _isAutosaveEnabled = true,
  registerFlush,
  showAiGenerate = false,
  onGenerate,
}: GroupPositionsProps) {
  const ids = useMemo(
    () => group_position_ids ?? [],
    [group_position_ids]
  );
  const show = show_group_positions ?? false;
  const allItems = useMemo(
    () => group_positions ?? [],
    [group_positions]
  );
  const suggestionsList = useMemo(
    () => group_position_suggestions ?? [],
    [group_position_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "group_positions",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((g) => g.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    if (!group_id) return;
    const lastId = ids.length > 0 ? ids[ids.length - 1] : null;
    return { group_positions_id: lastId };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert to items format for SelectableGrid
  const items = useMemo(() => {
    return allItems
      .filter((g) => g.id)
      .map((g) => ({
        id: g.id!,
        groups_id: g.groups_id ?? "",
        eval_id: g.eval_id ?? "",
        value: g.value ?? null,
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

  // Check if any resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return group_position_resources?.some((g) => g.generated) ?? false;
  }, [group_position_resources]);

  // Accept AI suggestion - add AI-suggested group positions to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((g) => g.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
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
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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

      <SelectableGrid<GroupPositionItem>
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
                  {item.groups_id
                    ? `Group: ${item.groups_id.slice(0, 8)}...`
                    : ""}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No group positions available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
