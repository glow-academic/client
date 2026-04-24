/**
 * Protocols.tsx
 * Multi-select protocol picker. Mirrors Departments.tsx (SelectableGrid card
 * grid, horizontal scroll) and adds an inline "create" input: values the user
 * types are emitted via `onValuesChange` so the parent can forward them as
 * raw `protocols: string[]` on the next draft save — the server resolves or
 * creates each one and echoes back `protocol_ids`.
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface ProtocolResourceItem {
  id?: string | null;
  value?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

interface ProtocolGridItem {
  id: string;
  value: string;
  isNew?: boolean;
}

export interface ProtocolsProps {
  protocol_ids?: string[];
  protocol_resources?: ProtocolResourceItem[];
  show_protocols?: boolean;
  protocols?: ProtocolResourceItem[];
  /** Raw values the user typed that haven't been resolved to ids yet. */
  protocol_values?: string[];
  /** Emit the next raw-value array (parent forwards as `protocols` on save). */
  onValuesChange?: (values: string[]) => void;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
}

export function Protocols({
  protocol_ids,
  protocol_resources: _protocol_resources,
  show_protocols = false,
  protocols,
  protocol_values,
  onValuesChange,
  disabled = false,
  onChange,
  label = "Protocols",
  id = "protocols",
  required = false,
  description,
}: ProtocolsProps) {
  const ids = useMemo(() => protocol_ids ?? [], [protocol_ids]);
  const values = useMemo(() => protocol_values ?? [], [protocol_values]);
  const show = show_protocols ?? false;
  const allProtocols = useMemo(() => protocols ?? [], [protocols]);
  const [input, setInput] = useState("");

  const pendingItems = useMemo(
    () => allProtocols.filter((p) => p.pending && p.id),
    [allProtocols],
  );
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const catalogItems = useMemo<ProtocolGridItem[]>(
    () =>
      allProtocols
        .filter((p) => p.id && p.value)
        .map((p) => ({ id: p.id!, value: p.value! })),
    [allProtocols],
  );

  const gridItems = useMemo<ProtocolGridItem[]>(() => {
    const existingLower = new Set(
      catalogItems.map((p) => p.value.toLowerCase()),
    );
    const pseudo = values
      .filter((v) => v && !existingLower.has(v.toLowerCase()))
      .map<ProtocolGridItem>((v) => ({ id: `new:${v}`, value: v, isNew: true }));
    return [...catalogItems, ...pseudo];
  }, [catalogItems, values]);

  const isSuggested = useCallback(
    (protocolId: string) => {
      const p = allProtocols.find((x) => x.id === protocolId);
      return p?.suggested === true;
    },
    [allProtocols],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      if (itemId.startsWith("new:")) {
        // Clicking a pseudo-card removes that pending value.
        const raw = itemId.slice(4);
        onValuesChange?.(values.filter((v) => v !== raw));
        return;
      }
      onChange(
        ids.includes(itemId) ? ids.filter((x) => x !== itemId) : [...ids, itemId],
      );
    },
    [ids, values, onChange, onValuesChange],
  );

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    // Match existing catalog entry — select it instead of creating a duplicate.
    const existing = catalogItems.find((p) => p.value.toLowerCase() === lower);
    if (existing) {
      if (!ids.includes(existing.id)) onChange([...ids, existing.id]);
      setInput("");
      return;
    }

    // Otherwise append as a pending raw value.
    if (!values.some((v) => v.toLowerCase() === lower)) {
      onValuesChange?.([...values, trimmed]);
    }
    setInput("");
  }, [input, catalogItems, ids, values, onChange, onValuesChange]);

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

      {onValuesChange && (
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-new`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Type a protocol and press Enter…"
            disabled={disabled}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled || !input.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      )}

      <SelectableGrid<ProtocolGridItem>
        horizontal
        items={gridItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          const isNew = !!item.isNew;
          const effectiveSelected = isNew || isSelected;
          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[72px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                effectiveSelected && !isPending && !isNew && "ring-2 ring-primary bg-accent",
                isPending && "ring-2 ring-success bg-success/10",
                isNew && "ring-2 ring-primary/60 bg-primary/5 border-dashed",
              )}
            >
              {isSelected && !isPending && !isNew && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isNew && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded font-medium">
                  New
                </div>
              )}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isPending && !isNew && (
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
                <span className="text-sm font-medium truncate">
                  {item.value}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No protocols yet. Type one above to add it."
        disabled={disabled}
      />
    </div>
  );
}
