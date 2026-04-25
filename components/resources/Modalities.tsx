/**
 * Modalities.tsx
 * Multi-select modalities picker. Card grid (SelectableGrid horizontal) with
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

export interface ModalityResourceItem {
  id?: string | null;
  modality_id?: string | null;
  modality?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

interface ModalityGridItem {
  id: string;
  name: string;
  description?: string;
}

export interface ModalitiesProps {
  modality_ids?: string[];
  modality_resources?: ModalityResourceItem[];
  show_modalities?: boolean;
  modalities?: ModalityResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
}

export function Modalities({
  modality_ids,
  show_modalities = false,
  modalities,
  disabled = false,
  onChange,
  label = "Modalities",
  id = "modalities",
  required = false,
  description,
}: ModalitiesProps) {
  const ids = useMemo(() => modality_ids ?? [], [modality_ids]);
  const show = show_modalities ?? false;
  const allModalities = useMemo(() => modalities ?? [], [modalities]);

  const pendingItems = useMemo(
    () => allModalities.filter((m) => m.pending && m.modality_id),
    [allModalities],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () =>
      new Set(pendingItems.map((m) => m.modality_id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const items = useMemo<ModalityGridItem[]>(
    () =>
      allModalities
        .filter((m) => m.modality_id && m.name)
        .map((m) => ({
          id: m.modality_id!,
          name: m.name!,
          ...(m.description ? { description: m.description } : {}),
        })),
    [allModalities],
  );

  const isSuggested = useCallback(
    (modalityId: string) => {
      const m = allModalities.find((x) => x.modality_id === modalityId);
      return m?.suggested === true;
    },
    [allModalities],
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

      <SelectableGrid<ModalityGridItem>
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
        emptyMessage="No modalities available."
        disabled={disabled}
      />
    </div>
  );
}
