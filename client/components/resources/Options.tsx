/**
 * Options.tsx
 * Resource component for option selection
 * Uses SelectableGrid to display options as horizontal scrollable cards
 * Manages option_ids array and reports to parent
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
import { cn } from "@/lib/utils";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type FlushResult = { option_id: string | null } | void;

type CreateDraftOptionsIn = InputOf<"/api/v4/resources/options", "post">;
type CreateDraftOptionsOut = OutputOf<"/api/v4/resources/options", "post">;

// Derive resource item type from the GET endpoint response
type OptionsGetResponse = OutputOf<"/api/v4/resources/options/get", "post">;
export type OptionResourceItem = NonNullable<OptionsGetResponse["items"]>[number];

export interface OptionItem {
  id: string;
  option_text: string;
  is_correct: boolean;
}

export interface OptionsProps {
  option_ids?: string[];
  option_resources?: OptionResourceItem[];
  show_options?: boolean;
  option_suggestions?: string[];
  options?: OptionResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  group_id?: string | null;
  create_tool_id?: string | null;
  createOptionsAction?:
    | ((input: CreateDraftOptionsIn) => Promise<CreateDraftOptionsOut>)
    | undefined;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save */
  registerFlush?: (flush: () => Promise<FlushResult>) => void;
  // AI diff props (deprecated - now handled by useResourceAi hook)
  aiOptionResources?: Array<{
    option_id?: string | null;
    option_text?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Options({
  option_ids,
  option_resources,
  show_options = false,
  option_suggestions,
  options,
  disabled = false,
  onChange,
  label = "Options",
  group_id,
  create_tool_id: _create_tool_id,
  createOptionsAction: _createOptionsAction,
  isAutosaveEnabled: _isAutosaveEnabled = true,
  registerFlush,
  showAiGenerate = false,
  onGenerate,
}: OptionsProps) {
  const ids = useMemo(() => option_ids ?? [], [option_ids]);
  const show = show_options ?? false;
  const allOptions = useMemo(() => options ?? [], [options]);
  const suggestionsList = useMemo(
    () => option_suggestions ?? [],
    [option_suggestions]
  );

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<FlushResult>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<FlushResult> => {
    if (!group_id) return;
    const lastId = ids.length > 0 ? ids[ids.length - 1] : null;
    return { option_id: lastId };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, accept: acceptAi, reject: rejectAi } = useResourceAi<{
    option_id: string | null;
    option_text: string | null;
  }>({
    resourceType: "options",
    groupId: group_id,
    extractSuggestion: (data) => {
      if (!data.success && data.success !== undefined) return null;
      return { option_id: (data.option_id as string) ?? null, option_text: (data.option_text as string) ?? null };
    },
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((o) => o.option_id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert to items format for SelectableGrid
  const optionItems = useMemo(() => {
    return allOptions
      .filter((o) => o.option_id)
      .map((o) => ({
        id: o.option_id!,
        option_text: o.option_text ?? "",
        is_correct: o.is_correct ?? false,
      }));
  }, [allOptions]);

  const isSuggested = useCallback(
    (optionId: string) => suggestionsList.includes(optionId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any option resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return option_resources?.some((o) => o.generated) ?? false;
  }, [option_resources]);

  // Accept AI suggestion - add AI-suggested options to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((o) => o.option_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    acceptAi();
  }, [aiSuggestions, ids, onChange, acceptAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    rejectAi();
  }, [rejectAi]);

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

      <SelectableGrid<OptionItem>
        items={optionItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(optionId) => {
          const newIds = ids.includes(optionId)
            ? ids.filter((id) => id !== optionId)
            : [...ids, optionId];
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
                <span className="text-sm font-medium truncate">
                  {item.option_text || "Unnamed"}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    item.is_correct
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                >
                  {item.is_correct ? "Correct" : "Incorrect"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No options available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
