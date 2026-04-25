"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ArgPositionResourceItem {
  id?: string | null;
  args_id?: string | null;
  value?: number | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface ArgPositionItem {
  args_id: string;
  value: number;
  generated?: boolean;
}

interface ArgPositionsProps {
  args_ids: string[];
  args_resources?: Array<{
    id?: string | null;
    name?: string | null;
  }>;
  arg_position_ids?: string[];
  arg_position_resources?: ArgPositionResourceItem[];
  tool_id?: string | null;
  disabled?: boolean;
  onPositionIdsChange?: (ids: string[]) => void;
  onOrderChange?: (orderedArgsIds: string[]) => void;
  /** Hide the "Argument Positions" header label — the orchestrator owns it. */
  hideHeader?: boolean;
}

export function ArgPositions({
  args_ids,
  args_resources,
  arg_position_resources,
  disabled = false,
  onPositionIdsChange,
  onOrderChange,
  hideHeader = false,
}: ArgPositionsProps) {

  const [orderedArgs, setOrderedArgs] = useState<string[]>(args_ids);
  // Dirty flag: once the user moves an arg, stop syncing from server so
  // in-progress reordering isn't clobbered (same pattern as Examples.tsx).
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const [positionIdsByArg, setPositionIdsByArg] = useState<Map<string, string>>(
    new Map()
  );

  const argNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (args_resources ?? []).forEach((arg) => {
      if (arg.id) {
        map.set(arg.id, arg.name?.trim() || "Unnamed arg");
      }
    });
    return map;
  }, [args_resources]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return (arg_position_resources ?? []).filter((item) => item.pending && item.args_id);
  }, [arg_position_resources]);
  const showDiff = pendingItems.length > 0;
  const pendingArgsIds = useMemo(
    () => new Set(pendingItems.map((item) => item.args_id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Accept pending — positions are already reflected in ordering, just confirm
  const handleAccept = useCallback(() => {
    // Pending items are already in the ordered list, nothing to change
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending items from the ordered list and position IDs
  const handleReject = useCallback(() => {
    isDirtyRef.current = true;
    const newOrdered = orderedArgs.filter((argId) => !pendingArgsIds.has(argId));
    setOrderedArgs(newOrdered);
    onOrderChange?.(newOrdered);
    if (onPositionIdsChange) {
      const ids = newOrdered
        .map((argId) => positionIdsByArg.get(argId))
        .filter((id): id is string => !!id);
      onPositionIdsChange(ids);
    }
  }, [orderedArgs, pendingArgsIds, onOrderChange, onPositionIdsChange, positionIdsByArg]);

  // Sync from server — skip while user is reordering.
  useEffect(() => {
    if (isDirtyRef.current) return;
    const valueByArg = new Map<string, number>();
    const idByArg = new Map<string, string>();

    (arg_position_resources ?? []).forEach((item) => {
      if (item.args_id && item.value !== null && item.value !== undefined) {
        valueByArg.set(item.args_id, item.value);
      }
      if (item.args_id && item.id) {
        idByArg.set(item.args_id, item.id);
      }
    });

    const nextOrder = [...args_ids].sort((a, b) => {
      const av = valueByArg.get(a);
      const bv = valueByArg.get(b);
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av - bv;
    });

    setOrderedArgs(nextOrder);
    setPositionIdsByArg(idByArg);
  }, [args_ids, arg_position_resources]);

  // Emit order changes upward. Only emit after initial mount and when the
  // user has actually reordered — otherwise the sync effect above would emit
  // on every prop change and trigger spurious saves.
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDirtyRef.current) return;
    onOrderChange?.(orderedArgs);
  }, [orderedArgs, onOrderChange]);

  useEffect(() => {
    if (!isDirtyRef.current) return;
    if (!onPositionIdsChange) return;
    const ids = orderedArgs
      .map((argId) => positionIdsByArg.get(argId))
      .filter((id): id is string => !!id);
    onPositionIdsChange(ids);
  }, [onPositionIdsChange, orderedArgs, positionIdsByArg]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedArgs.length) return;

    isDirtyRef.current = true;
    const next = [...orderedArgs];
    const tmp = next[index];
    next[index] = next[target]!;
    next[target] = tmp!;
    setOrderedArgs(next);
  };

  if (!args_ids.length) {
    return <p className="text-sm text-muted-foreground">Select args to configure positions.</p>;
  }

  return (
    <div className="space-y-3" data-resource="arg_positions">
      {!hideHeader && (
      <div className="flex items-center gap-2">
        <Label>Argument Positions</Label>
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
      <div className="space-y-2">
        {orderedArgs.map((argId, index) => {
          const isPending = pendingArgsIds.has(argId);

          return (
            <div
              key={argId}
              className={cn(
                "flex items-center justify-between rounded-md border p-3",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium">{index + 1}. {argNameMap.get(argId) ?? "Unnamed arg"}</p>
                  <p className="text-xs text-muted-foreground">Stored value: {index}</p>
                </div>
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={disabled || index === orderedArgs.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
