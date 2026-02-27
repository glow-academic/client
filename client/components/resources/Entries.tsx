/**
 * Entries.tsx
 * Resource component for entry selection
 * Uses SelectableGrid to display entries as horizontal scrollable cards
 * Manages entry_ids array and reports to parent
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
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type EntriesGetResponse = OutputOf<"/api/v4/resources/entries/get", "post">;
export type EntriesResourceItem = NonNullable<EntriesGetResponse["items"]>[number];

export interface EntryItem {
  id: string;
  entry: string;
}

export interface EntriesProps {
  entry_ids?: string[];
  entry_resources?: EntriesResourceItem[];
  show_entries?: boolean;
  entry_suggestions?: string[];
  entries?: EntriesResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  group_id?: string | null;
  // AI diff props (deprecated - now handled by useResourceAi hook)
  aiEntryResources?: Pick<EntriesResourceItem, "id" | "entry">[] | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
}

export function Entries({
  entry_ids,
  entry_resources,
  show_entries = false,
  entry_suggestions,
  entries,
  disabled = false,
  onChange,
  label = "Entries",
  group_id,
  showAiGenerate,
  onGenerate,
}: EntriesProps) {
  const ids = useMemo(() => entry_ids ?? [], [entry_ids]);
  const show = show_entries ?? false;
  const allEntries = useMemo(() => entries ?? [], [entries]);
  const suggestionsList = useMemo(
    () => entry_suggestions ?? [],
    [entry_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "entries",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((b) => b.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert to items format for SelectableGrid
  const entryItems = useMemo(() => {
    return allEntries
      .filter((b) => b.id)
      .map((b) => ({
        id: b.id!,
        entry: b.entry ?? "",
      }));
  }, [allEntries]);

  const isSuggested = useCallback(
    (entryId: string) => suggestionsList.includes(entryId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept AI suggestion - add AI-suggested entries to selection
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((b) => b.id)
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

  // Check if any entry resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return entry_resources?.some((b) => b.generated) ?? false;
  }, [entry_resources]);

  // Don't render if show_entries is false (AFTER all hooks)
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

      <SelectableGrid<EntryItem>
        items={entryItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(entryId) => {
          const newIds = ids.includes(entryId)
            ? ids.filter((id) => id !== entryId)
            : [...ids, entryId];
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
                  {item.entry || "Unnamed"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No entries available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
