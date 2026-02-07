/**
 * Runs.tsx
 * Resource component for run selection
 * Uses SelectableGrid to select existing run resources
 * Manages run_ids array and reports to parent
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface RunItem {
  id: string;
  name: string;
  description?: string;
}

export interface RunsProps {
  run_ids?: string[]; // Current run resource IDs (standardized prop name)
  run_resources?: Array<{
    run_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected run resources (each includes generated field)
  show_runs?: boolean; // Whether to show this resource picker
  run_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  runs?: Array<{
    run_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available runs from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update run_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiRunResources?: Array<{
    run_id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Runs({
  run_ids,
  run_resources,
  show_runs = false,
  run_suggestions,
  runs,
  disabled = false,
  onChange,
  label = "Runs",
  id = "runs",
  required = false,
  description,
  group_id,
  link_tool_id,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  // AI diff view props
  aiRunResources,
  onAccept,
  onReject,
}: RunsProps) {
  const ids = useMemo(() => run_ids ?? [], [run_ids]);
  const show = show_runs ?? false;
  const allRuns = useMemo(() => runs ?? [], [runs]);
  const suggestionsList = useMemo(
    () => run_suggestions ?? [],
    [run_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiRunResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRunResources
          ?.map((r) => r.run_id)
          .filter(Boolean) as string[]
      ),
    [aiRunResources]
  );

  // Convert runs array to RunItem format for grid rendering
  const runItems = useMemo(() => {
    return allRuns
      .filter((r) => r.run_id && r.name) // Filter out nulls
      .map((r) => ({
        id: r.run_id!,
        name: r.name!,
        ...(r.description ? { description: r.description } : {}),
      }));
  }, [allRuns]);

  // Check if a run is suggested
  const isSuggested = useCallback(
    (runId: string) => suggestionsList.includes(runId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedId: string) => {
      const isSelected = ids.includes(selectedId);
      const nextIds = isSelected
        ? ids.filter((id) => id !== selectedId)
        : [...ids, selectedId];

      onChange(nextIds);
    },
    [ids, onChange]
  );

  // Check if any run resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return run_resources?.some((r) => r.generated) ?? false;
  }, [run_resources]);

  // Accept AI suggestion - add AI-suggested runs to selection
  const handleAccept = useCallback(() => {
    if (!aiRunResources?.length) return;
    const newIds = aiRunResources
      .map((r) => r.run_id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiRunResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_runs is false (AFTER all hooks)
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
      <SelectableGrid
        horizontal
        items={runItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "w-full rounded-lg border p-3 transition-colors",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-muted/60 hover:border-muted-foreground/50",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    {isAiSuggested && !isSelected && (
                      <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                        AI Suggested
                      </span>
                    )}
                    {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                      <span className="text-xs text-muted-foreground">
                        Suggested
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted"
                  )}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage="No runs found."
        disabled={disabled}
      />
    </div>
  );
}
