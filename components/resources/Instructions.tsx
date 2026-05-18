/**
 * Instructions.tsx
 * Resource component for instructions textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Pure UI component that reports value changes upward via onInstructionsChange
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";

export interface InstructionResourceItem {
  id?: string | null;
  instruction?: string | null;
  template?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

// Word-based diff types and utilities
type DiffSegment = { type: "same" | "removed" | "added"; text: string };

function computeDiff(oldText: string, newText: string): DiffSegment[] {
  // Split text into words while preserving whitespace
  const splitWords = (text: string): string[] => {
    const result: string[] = [];
    let current = "";
    for (const char of text) {
      if (/\s/.test(char)) {
        if (current) {
          result.push(current);
          current = "";
        }
        result.push(char);
      } else {
        current += char;
      }
    }
    if (current) result.push(current);
    return result;
  };

  const oldWords = splitWords(oldText);
  const newWords = splitWords(newText);

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to find diff
  const segments: DiffSegment[] = [];
  let i = m, j = n;
  const tempSegments: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      tempSegments.push({ type: "same", text: oldWords[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      tempSegments.push({ type: "added", text: newWords[j - 1]! });
      j--;
    } else {
      tempSegments.push({ type: "removed", text: oldWords[i - 1]! });
      i--;
    }
  }

  // Reverse and merge consecutive segments of same type
  tempSegments.reverse();
  for (const seg of tempSegments) {
    if (segments.length > 0 && segments[segments.length - 1]!.type === seg.type) {
      segments[segments.length - 1]!.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}

// Inline DiffView component
function DiffView({
  current,
  proposed,
  rows,
}: {
  current: string;
  proposed: string;
  rows: number;
}) {
  const segments = useMemo(() => computeDiff(current, proposed), [current, proposed]);

  return (
    <div
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "whitespace-pre-wrap overflow-auto"
      )}
      style={{ minHeight: `${rows * 1.5}rem` }}
    >
      {segments.map((seg, i) => (
        <span
          key={i}
          className={cn(
            seg.type === "removed" && "bg-destructive/20 text-destructive line-through",
            seg.type === "added" && "bg-success/20 text-success"
          )}
        >
          {seg.text}
        </span>
      ))}
    </div>
  );
}

export interface InstructionsProps {
  instructions_id?: string | null; // Current instructions_id (standardized prop name)
  instructions_resource?: InstructionResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_instructions?: boolean; // Whether to show this resource picker
  instructions?: InstructionResourceItem[]; // Array of instruction resources (each item has suggested field)
  disabled?: boolean; // Based on can_edit flag
  onInstructionsIdChange: (instructionsId: string | null) => void; // Update instructions_id in parent form state
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  onInstructionsChange?: (instructions: string) => void; // Report value changes to parent
  searchTerm?: string; // Search term for filtering instructions
  onSearchChange?: (term: string) => void; // Callback when search term changes
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Per-field pending lifecycle. See Names.tsx for the full pattern. */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
  // Legacy props for backward compatibility
  instructionsResource?: { id: string; template: string; generated?: boolean | null } | null;
  instructionsId?: string | null;
}

export function Instructions({
  instructions_id,
  instructions_resource,
  show_instructions = true,
  instructions,
  disabled = false,
  onInstructionsIdChange,
  label = "Instructions",
  placeholder = "Enter instructions",
  required = false,
  rows = 8,
  id = "instructions",
  "data-testid": dataTestId,
  helpText,
  onInstructionsChange,
  searchTerm,
  onSearchChange,
  isAutosaveEnabled = true,
  onAcceptPending,
  onRejectPending,
  // Legacy props for backward compatibility
  instructionsResource,
  instructionsId,
}: InstructionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = instructions_resource ?? instructionsResource ?? null;
  const resourceId = instructions_id ?? instructionsId ?? null;
  const show = show_instructions ?? true;
  // Handle nullable resource properties
  const resourceTemplate = resource?.template ?? "";
  const [internalValue, setInternalValue] = useState(resourceTemplate);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceTemplate);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const lastServerTextRef = useRef<string>(resourceTemplate);

  // Pending state: current resource has pending=true (soft draft, awaiting acceptance)
  const isPending = resource?.pending === true;

  const instructionsById = useMemo(() => {
    const mapping: Record<string, string> = {};
    (instructions ?? []).forEach((inst) => {
      if (inst.id && inst.template) {
        mapping[inst.id] = inst.template;
      }
    });
    return mapping;
  }, [instructions]);

  // Update internal value when instructions_resource changes
  useEffect(() => {
    const resourceMatchesId =
      (resourceId && resource?.id && resourceId === resource.id) ||
      (resourceId === null &&
        (resource?.id === null || resource?.id === undefined));
    const resourceValue = resourceMatchesId ? resourceTemplate : "";
    const mappedValue = resourceId ? instructionsById[resourceId] : undefined;
    const hasServerValue =
      resourceValue !== "" || mappedValue !== undefined || resourceId === null;
    if (!hasServerValue) return;
    const serverValue =
      resourceValue !== "" ? resourceValue : mappedValue ?? "";
    if (serverValue === lastServerTextRef.current) return;
    if (!isDirtyRef.current) {
      setInternalValue(serverValue);
      lastSavedValueRef.current = serverValue;
    }
    lastServerTextRef.current = serverValue;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceTemplate, resourceId, instructionsById]);

  // Track and report pending changes (for manual save mode only)
  useEffect(() => {
    // Only report pending changes when autosave is disabled
    // When autosave is enabled, Persona.tsx handles the "saving" state directly
    if (isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    const hasPendingChanges = internalValue !== lastSavedValueRef.current;
    if (hasPendingChanges) {
      // Notify save context that there are unsaved changes
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalValue, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
    onInstructionsChange?.(newValue);
  }, [onInstructionsChange]);

  // Pending diff view state
  const showDiff = isPending;
  const currentText = internalValue || "";
  const pendingText = resource?.template || "";

  // Accept pending — confirm the pending resource as the active selection.
  // See Names.tsx for the parent-hook pattern.
  const handleAccept = useCallback(() => {
    if (!resource?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveSeqRef.current += 1;
    const text = resource.template || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    lastServerTextRef.current = text;
    isDirtyRef.current = false;
    if (onAcceptPending) {
      onAcceptPending(resource.id);
    } else {
      onInstructionsIdChange(resource.id);
    }
  }, [resource, onAcceptPending, onInstructionsIdChange]);

  // Reject pending — drop the pending resource from form state.
  const handleReject = useCallback(() => {
    const pendingId = resource?.id;
    if (onRejectPending && pendingId) {
      onRejectPending(pendingId);
      return;
    }
    onInstructionsIdChange(null);
  }, [onInstructionsIdChange]);

  // Use instructions array if available
  const suggestionsMapping = useMemo(() => {
    const mapping: Record<string, { id: string; template: string; generated: boolean | null }> = {};
    if (instructions && instructions.length > 0) {
      instructions.forEach((inst) => {
        if (inst.id) {
          mapping[inst.id] = {
            id: inst.id,
            template: inst.template || `Instructions ${inst.id.slice(0, 8)}...`,
            generated: inst.generated ?? null,
          };
        }
      });
    }
    return mapping;
  }, [instructions]);
  
  // Use instructions array for GenericPicker items if available
  const pickerItems = instructions && instructions.length > 0
    ? instructions
    : Object.values(suggestionsMapping);

  // Don't render if show_instructions is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
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
        {/* GenericPicker for suggestions - always show */}
        <GenericPicker
          items={pickerItems}
          selectedIds={resourceId ? [resourceId] : []}
          onSelect={(ids) => {
            const selectedId = ids[0] || null;
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            saveSeqRef.current += 1;
            if (selectedId) {
              const nextValue = instructionsById[selectedId] ?? "";
              setInternalValue(nextValue);
              lastSavedValueRef.current = nextValue;
              lastServerTextRef.current = nextValue;
            } else {
              setInternalValue("");
              lastSavedValueRef.current = "";
              lastServerTextRef.current = "";
            }
            isDirtyRef.current = false;
            onInstructionsIdChange(selectedId);
          }}
          getId={(item) => item.id || ''}
          getLabel={(item) => {
            return item.template || `Instructions ${(item.id || '').slice(0, 8)}...`;
          }}
          placeholder="Instructions"
          disabled={disabled}
          multiSelect={false}
          compact={true}
          buttonClassName="h-8"
          showLabel={false}
          initialSearchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
      </div>
      {/* Conditional: DiffView when pending, otherwise Textarea */}
      {showDiff ? (
        <div className="ring-2 ring-success rounded-md">
          <DiffView current={currentText} proposed={pendingText} rows={rows} />
        </div>
      ) : (
        <Textarea
          id={id}
          data-testid={dataTestId}
          value={internalValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
        />
      )}
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
