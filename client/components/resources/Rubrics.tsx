/**
 * Rubrics.tsx
 * Resource component for rubric selection
 * Uses SelectableGrid to display rubrics as horizontal scrollable cards
 * Manages rubric_ids array and reports to parent
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

export interface RubricItem {
  id: string;
  name: string;
  description?: string;
}

export interface RubricsProps {
  rubric_ids?: string[];
  rubric_resources?: Array<{
    id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  show_rubrics?: boolean;
  rubric_suggestions?: string[];
  rubrics?: Array<{
    id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  // AI diff props
  aiRubricResources?: Array<{
    id?: string | null;
    name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Rubrics({
  rubric_ids,
  rubric_resources,
  show_rubrics = false,
  rubric_suggestions,
  rubrics,
  disabled = false,
  onChange,
  label = "Rubrics",
  // AI diff props
  aiRubricResources,
  onAccept,
  onReject,
}: RubricsProps) {
  const ids = useMemo(() => rubric_ids ?? [], [rubric_ids]);
  const show = show_rubrics ?? false;
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);
  const suggestionsList = useMemo(
    () => rubric_suggestions ?? [],
    [rubric_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiRubricResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRubricResources
          ?.map((r) => r.id)
          .filter(Boolean) as string[]
      ),
    [aiRubricResources]
  );

  // Convert to items format for SelectableGrid
  const rubricItems = useMemo(() => {
    return allRubrics
      .filter((r) => r.id && r.name)
      .map((r) => ({
        id: r.id!,
        name: r.name!,
        ...(r.description ? { description: r.description } : {}),
      }));
  }, [allRubrics]);

  const isSuggested = useCallback(
    (rubricId: string) => suggestionsList.includes(rubricId),
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
    if (!aiRubricResources?.length) return;
    const newIds = aiRubricResources
      .map((r) => r.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiRubricResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Check if any resource is generated (must be before early return)
  const _hasGenerated = useMemo(() => {
    return rubric_resources?.some((r) => r.generated) ?? false;
  }, [rubric_resources]);

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

      <SelectableGrid<RubricItem>
        items={rubricItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(rubricId) => {
          const newIds = ids.includes(rubricId)
            ? ids.filter((id) => id !== rubricId)
            : [...ids, rubricId];
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
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
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
                  {item.name}
                </span>
                {item.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No rubrics available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
