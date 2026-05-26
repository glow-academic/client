/**
 * Keys.tsx
 * Resource component for key picker fields
 * Single-select resource component following Colors.tsx pattern
 * Pure UI: data in, IDs out via onChange
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface KeyResourceItem {
  id?: string | null;
  key_id?: string | null;
  name?: string | null;
  description?: string | null;
  key_masked?: string | null;
  masked_key?: string | null;
  active?: boolean | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface KeyItem {
  id: string;
  name: string;
  description?: string;
  key_masked?: string;
  active?: boolean;
}

export interface KeysProps {
  key_id?: string | null; // Current key_id (standardized prop name)
  key_resource?: KeyResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_key?: boolean; // Whether to show this resource picker
  keys?: KeyResourceItem[]; // All available keys from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onKeyIdChange?: (keyId: string | null) => void; // Update key_id in parent form state (single-select)
  key_ids?: string[]; // Current key resource IDs (multi-select)
  key_resources?: KeyResourceItem[]; // Selected key resources (multi-select)
  onChange?: (ids: string[]) => void; // Update key_ids in parent form state (multi-select)
  multiSelect?: boolean; // Whether to use multi-select mode
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  /**
   * Canonical decrypt callback. When provided, each saved-key row in the
   * picker grows a Reveal/Hide button that calls `onReveal(key_id)` and
   * displays the plaintext for as long as the user keeps it open.
   * Implementation typically calls `POST /provider/decrypt` (audited).
   */
  onReveal?: (key_id: string) => Promise<string | null>;
  /** Per-field pending lifecycle (single-value). See Instructions.tsx. */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
}

export function Keys({
  key_id,
  show_key = false,
  keys,
  disabled = false,
  onKeyIdChange,
  key_ids,
  key_resources: _key_resources,
  onChange,
  multiSelect = false,
  label = "Key",
  id = "key",
  required = false,
  placeholder = "Select a key...",
  onReveal,
  onAcceptPending,
  onRejectPending,
}: KeysProps) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

  const handleReveal = useCallback(
    async (rowId: string) => {
      if (!onReveal) return;
      if (revealed[rowId]) {
        setRevealed((prev) => {
          const { [rowId]: _drop, ...rest } = prev;
          return rest;
        });
        return;
      }
      setRevealing((prev) => ({ ...prev, [rowId]: true }));
      try {
        const plaintext = await onReveal(rowId);
        if (plaintext != null) {
          setRevealed((prev) => ({ ...prev, [rowId]: plaintext }));
        }
      } finally {
        setRevealing((prev) => {
          const { [rowId]: _drop, ...rest } = prev;
          return rest;
        });
      }
    },
    [onReveal, revealed],
  );
  const resourceId = key_id ?? null;
  const show = show_key ?? false;

  const ids = useMemo(() => key_ids ?? [], [key_ids]);
  const allKeys = useMemo(() => keys ?? [], [keys]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allKeys.filter((k) => k.pending && (multiSelect ? k.key_id : k.id));
  }, [allKeys, multiSelect]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(
      pendingItems
        .map((k) => (multiSelect ? k.key_id : k.id))
        .filter(Boolean) as string[]
    ),
    [pendingItems, multiSelect]
  );

  // Convert keys array from API format to KeyItem format
  const keyItems = useMemo(() => {
    if (multiSelect) {
      // Multi-select: use key_id field
      return allKeys
        .filter((k) => k.key_id && k.name) // Filter out nulls
        .map((k) => ({
          id: k.key_id!,
          name: k.name!,
          ...(k.description ? { description: k.description } : {}),
          ...(k.masked_key ? { key_masked: k.masked_key } : {}),
          ...(k.active !== null ? { active: k.active } : {}),
        }));
    }
    // Single-select: use id field
    return allKeys
      .filter((k) => k.id && k.name) // Filter out nulls
      .map((k) => ({
        id: k.id!,
        name: k.name!,
        ...(k.description ? { description: k.description } : {}),
        ...(k.key_masked ? { key_masked: k.key_masked } : {}),
        ...(k.active !== null ? { active: k.active } : {}),
      }));
  }, [allKeys, multiSelect]);

  // Check if a key is suggested
  const isSuggested = useCallback(
    (keyId: string) => {
      const keyItem = allKeys.find((k) => (multiSelect ? k.key_id : k.id) === keyId);
      return keyItem?.suggested === true;
    },
    [allKeys, multiSelect]
  );

  const handleSelectMulti = useCallback(
    (selectedIds: string[]) => {
      if (onChange) {
        onChange(selectedIds);
      }
    },
    [onChange]
  );

  // Accept pending — keep pending keys in selection (no-op, they're already included)
  const handleAccept = useCallback(() => {
    // Single-value pending lifecycle: parent decides what acceptance means.
    if (!multiSelect && onAcceptPending) {
      const firstPendingId = pendingItems
        .map((k) => k.id)
        .find((pid): pid is string => !!pid);
      if (firstPendingId) {
        onAcceptPending(firstPendingId);
        return;
      }
    }
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, [multiSelect, onAcceptPending, pendingItems]);

  // Reject pending — remove pending keys from selection
  const handleReject = useCallback(() => {
    if (!multiSelect && onRejectPending) {
      const firstPendingId = pendingItems
        .map((k) => k.id)
        .find((pid): pid is string => !!pid);
      if (firstPendingId) {
        onRejectPending(firstPendingId);
        return;
      }
    }
    if (multiSelect && onChange) {
      const newIds = ids.filter((id) => !pendingIds.has(id));
      onChange(newIds);
    } else if (onKeyIdChange && pendingIds.has(resourceId ?? "")) {
      onKeyIdChange(null);
    }
  }, [ids, pendingIds, onChange, onKeyIdChange, resourceId, multiSelect, onRejectPending, pendingItems]);

  // Don't render if show_key is false (AFTER all hooks)
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

      <GenericPicker<KeyItem>
        items={keyItems}
        itemIds={multiSelect
          ? (allKeys.map((k) => k.key_id).filter((id): id is string => id !== null) ?? [])
          : (allKeys.map((k) => k.id).filter((id): id is string => id !== null) ?? [])}
        selectedIds={multiSelect ? ids : (resourceId ? [resourceId] : [])}
        onSelect={multiSelect
          ? handleSelectMulti
          : (selectedIds) => {
              if (onKeyIdChange) {
                onKeyIdChange(selectedIds.length > 0 ? (selectedIds[0] ?? null) : null);
              }
            }}
        multiSelect={multiSelect}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);
          const isRevealed = !!revealed[item.id];
          const isLoadingReveal = !!revealing[item.id];
          const displayKey = isRevealed
            ? revealed[item.id]
            : item.key_masked;

          return (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Pending badge */}
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium shrink-0">
                    Pending
                  </span>
                )}
                {/* Suggested dot indicator */}
                {isSuggested(item.id) && !isSelected && !isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex-1 min-w-0">
                  <div className={cn("truncate", isPending && "text-success")}>{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                  {displayKey && (
                    <div
                      className={cn(
                        "text-xs truncate font-mono",
                        isRevealed
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {displayKey}
                    </div>
                  )}
                </div>
              </div>
              {onReveal && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-7 w-7"
                  disabled={disabled || isLoadingReveal}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleReveal(item.id);
                  }}
                  title={isRevealed ? "Hide" : "Reveal"}
                >
                  {isRevealed ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {isSelected && !isPending && (
                <Check
                  className="ml-auto flex-shrink-0 h-4 w-4 opacity-100"
                />
              )}
            </div>
          );
        }}
        emptyMessage="No keys available."
        disabled={disabled}
        placeholder={placeholder}
        showLabel={false}
        hideSelectedChips={multiSelect ? false : true}
        showClearAll={multiSelect ? true : false}
      />
    </div>
  );
}
