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

export interface RubricsResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface RubricItem {
  id: string;
  name: string;
  description?: string;
}

export interface RubricsProps {
  rubric_ids?: string[];
  rubric_resources?: RubricsResourceItem[];
  show_rubrics?: boolean;
  rubrics?: RubricsResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
}

export function Rubrics({
  rubric_ids,
  rubric_resources: _rubric_resources,
  show_rubrics = false,
  rubrics,
  disabled = false,
  onChange,
  label = "Rubrics",
}: RubricsProps) {
  const ids = useMemo(() => rubric_ids ?? [], [rubric_ids]);
  const show = show_rubrics ?? false;
  const allRubrics = useMemo(() => rubrics ?? [], [rubrics]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allRubrics.filter((r) => r.pending && r.id);
  }, [allRubrics]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((r) => r.id).filter(Boolean) as string[]),
    [pendingItems]
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

  // Check if a rubric is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (rubricId: string) => {
      const rubric = allRubrics.find((r) => r.id === rubricId);
      return rubric?.suggested === true;
    },
    [allRubrics]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending rubrics in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending rubrics from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

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
          const isPending = pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Check icon - top right */}
              {isSelected && !isPending && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

              {/* Suggested dot indicator - top right */}
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
