/**
 * Values.tsx
 * Resource component for value input
 * Text input with ghost autocomplete for suggestions
 * Pure UI: data in, IDs out via onChange
 */

"use client";

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
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ValueResourceItem {
  id?: string | null;
  value?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
  selected?: boolean | null;
}

export interface ValuesProps {
  value_ids?: string[]; // Current value resource IDs (wrapped singular for compat)
  value_resources?: ValueResourceItem[]; // Selected value resources
  show_values?: boolean;
  values?: ValueResourceItem[]; // All available values (for autocomplete)
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  /** Per-field pending lifecycle (single-value). See Instructions.tsx. */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
}

export function Values({
  value_ids,
  value_resources,
  show_values = false,
  values,
  disabled = false,
  onChange,
  value,
  onValueChange,
  label = "Value",
  id = "value",
  required = false,
  placeholder = "Enter value",
  description,
  onAcceptPending,
  onRejectPending,
}: ValuesProps) {
  // Treat as single-value (callers wrap singular id into array)
  const resource = value_resources?.[0] ?? null;
  const show = show_values ?? false;
  const valuesArray = useMemo<ValueResourceItem[]>(() => values ?? [], [values]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItem = useMemo(() => {
    return valuesArray.find((v) => v.pending && v.id) ?? null;
  }, [valuesArray]);
  const showDiff = !!pendingItem;

  // Handle nullable resource properties
  const resourceValue = resource?.value ?? null;
  const initialValue = value ?? resourceValue ?? "";
  const [internalValue, setInternalValue] = useState(initialValue);

  const lastSavedValueRef = useRef<string>(initialValue);
  // Dirty flag: once the user interacts, stop syncing from server data so
  // their in-progress edits aren't clobbered (same pattern as Descriptions.tsx).
  const isDirtyRef = useRef(false);

  // Derive suggestion value strings from values with suggested=true
  const suggestionValues = useMemo(() => {
    return valuesArray
      .filter((item) => item.suggested && item.value)
      .map((item) => item.value!.trim())
      .filter((item) => item.length > 0);
  }, [valuesArray]);

  // Ghost autocomplete: find first prefix match and compute the untyped suffix
  const ghostMatch = useMemo(() => {
    const trimmed = internalValue.trim();
    if (!trimmed) return null;
    const valueLower = trimmed.toLowerCase();
    return suggestionValues.find((s) => {
      const sLower = s.toLowerCase();
      return sLower.startsWith(valueLower) && sLower !== valueLower;
    }) ?? null;
  }, [suggestionValues, internalValue]);

  const ghostSuffix = ghostMatch ? ghostMatch.slice(internalValue.length) : "";

  // Update internal value when resource changes. Skip while the user is
  // actively editing so their in-progress input isn't clobbered.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (value != null) {
      if (internalValue !== value) {
        setInternalValue(value);
      }
      lastSavedValueRef.current = value;
      return;
    }
    if (resourceValue) {
      if (internalValue !== resourceValue) {
        setInternalValue(resourceValue);
      }
      lastSavedValueRef.current = resourceValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceValue, value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      isDirtyRef.current = newValue !== lastSavedValueRef.current;
      onValueChange?.(newValue);
    },
    [onValueChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && ghostSuffix) {
        e.preventDefault();
        const nextValue = ghostMatch!;
        setInternalValue(nextValue);
        lastSavedValueRef.current = nextValue;
        isDirtyRef.current = false;
        const matchedResource = valuesArray.find(
          (item) => item.value?.toLowerCase() === nextValue.toLowerCase()
        );
        if (matchedResource?.id) {
          onChange([matchedResource.id]);
          onValueChange?.(null);
        } else {
          onValueChange?.(nextValue);
        }
      }
    },
    [ghostSuffix, ghostMatch, onChange, onValueChange, valuesArray]
  );

  // Accept pending — keep pending value in selection (no-op, already included)
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingItem?.id) {
      onAcceptPending(pendingItem.id);
      return;
    }
    // Pending item is already in ids (selected=true), just confirm
    // The next draft save will persist it as active
  }, [onAcceptPending, pendingItem]);

  // Reject pending — remove pending value from selection
  const handleReject = useCallback(() => {
    if (!pendingItem?.id) return;
    if (onRejectPending) {
      onRejectPending(pendingItem.id);
      return;
    }
    const newIds = (value_ids ?? []).filter((vid) => vid !== pendingItem.id);
    onChange(newIds);
  }, [value_ids, pendingItem, onChange, onRejectPending]);

  // Don't render if show_values is false (AFTER all hooks)
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
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={internalValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={cn(
            ghostSuffix && "pr-0",
            showDiff && "ring-2 ring-success bg-success/10"
          )}
        />
        {showDiff && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
            Pending
          </div>
        )}
        {ghostSuffix && !disabled && !showDiff && (
          <div className="absolute inset-0 pointer-events-none flex items-center px-3">
            <span className="invisible text-sm">{internalValue}</span>
            <span className="text-sm text-muted-foreground/40">{ghostSuffix}</span>
          </div>
        )}
      </div>
    </div>
  );
}
