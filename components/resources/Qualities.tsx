/**
 * Qualities.tsx
 * Multi-select qualities picker. Card grid (SelectableGrid horizontal) with
 * suggested dot, pending badge, and accept/reject affordances — mirrors
 * Departments.tsx.
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

export interface QualitiesResourceItem {
  id?: string | null;
  quality?: string | null;
  quality_id?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

interface QualitiesGridItem {
  id: string;
  name: string;
  description?: string;
}

export interface QualitiesProps {
  quality_ids?: string[];
  quality_resources?: QualitiesResourceItem[];
  show_qualities?: boolean;
  qualities?: QualitiesResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
}

export function Qualities({
  quality_ids,
  quality_resources: _quality_resources,
  show_qualities = false,
  qualities,
  disabled = false,
  onChange,
  label = "Qualities",
  id = "qualities",
  required = false,
  description,
}: QualitiesProps) {
  const ids = useMemo(() => quality_ids ?? [], [quality_ids]);
  const show = show_qualities ?? false;
  const allQualities = useMemo(() => qualities ?? [], [qualities]);

  const pendingItems = useMemo(
    () => allQualities.filter((q) => q.pending && q.id),
    [allQualities],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((q) => q.id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const items = useMemo<QualitiesGridItem[]>(
    () =>
      allQualities
        .filter((q) => q.id && q.quality)
        .map((q) => ({
          id: q.id!,
          name: q.quality!,
          ...(q.description ? { description: q.description } : {}),
        })),
    [allQualities],
  );

  const isSuggested = useCallback(
    (qualityId: string) => {
      const q = allQualities.find((x) => x.id === qualityId);
      return q?.suggested === true;
    },
    [allQualities],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      onChange(
        ids.includes(itemId) ? ids.filter((x) => x !== itemId) : [...ids, itemId],
      );
    },
    [ids, onChange],
  );

  const handleAccept = useCallback(() => {
    // Pending items are already in selection — next save persists them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(ids.filter((x) => !pendingIds.has(x)));
  }, [ids, pendingIds, onChange]);

  if (!show) return null;

  return (
    <div className="space-y-3 min-w-0 w-full">
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

      <SelectableGrid<QualitiesGridItem>
        horizontal
        items={items}
        selectedId={null}
        selectedIds={ids}
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
                {item.description && (
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No qualities available."
        disabled={disabled}
      />
    </div>
  );
}
