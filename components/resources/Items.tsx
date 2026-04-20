/**
 * Items.tsx
 * Resource component for item selection
 * Uses SelectableGrid to display items as horizontal scrollable cards
 * Manages item_ids array and reports to parent
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

export interface ItemResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  encrypted?: boolean | null;
  position?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ItemItem {
  id: string;
  name: string;
  description: string;
  encrypted: boolean;
  position: number | null;
}

export interface ItemsProps {
  item_ids?: string[];
  item_resources?: ItemResourceItem[];
  show_items?: boolean;
  items?: ItemResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
}

export function Items({
  item_ids,
  item_resources: _item_resources,
  show_items = false,
  items,
  disabled = false,
  onChange,
  label = "Items",
  id = "items",
  required = false,
  description,
}: ItemsProps) {
  const ids = useMemo(() => item_ids ?? [], [item_ids]);
  const show = show_items ?? false;
  const allItems = useMemo(() => items ?? [], [items]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allItems.filter((i) => i.pending && i.id);
  }, [allItems]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((i) => i.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert to items format for SelectableGrid
  const itemItems = useMemo(() => {
    return allItems
      .filter((i) => i.id)
      .map((i) => ({
        id: i.id!,
        name: i.name ?? "",
        description: i.description ?? "",
        encrypted: i.encrypted ?? false,
        position: i.position ?? null,
      }));
  }, [allItems]);

  // Check if an item is suggested (from item.suggested field)
  const isSuggested = useCallback(
    (itemId: string) => {
      const item = allItems.find((i) => i.id === itemId);
      return item?.suggested === true;
    },
    [allItems]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending items in selection (no-op, they're already in ids)
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending items from selection
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
      )}

      <SelectableGrid<ItemItem>
        items={itemItems}
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
                  {item.name || "Unnamed"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {item.description || "No description"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No items available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
