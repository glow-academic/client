/**
 * Instructions.tsx
 * Resource component for instructions textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";

type CreateDraftInstructionsIn = InputOf<
  "/api/v5/resources/instructions",
  "post"
>;
type CreateDraftInstructionsOut = OutputOf<
  "/api/v5/resources/instructions",
  "post"
>;
type LinkInstructionsIn = InputOf<"/api/v5/resources/instructions/link", "post">;
type LinkInstructionsOut = OutputOf<"/api/v5/resources/instructions/link", "post">;

// Derive resource item type from the GET endpoint response
type InstructionsGetResponse = OutputOf<"/api/v5/resources/instructions/get", "post">;
export type InstructionResourceItem = NonNullable<InstructionsGetResponse["items"]>[number];

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
  instructions_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  instructions?: InstructionResourceItem[]; // Array of suggested instruction resources (only suggested options, not all)
  disabled?: boolean; // Based on can_edit flag
  onInstructionsIdChange: (instructionsId: string | null) => void; // Update instructions_id in parent form state
  onGenerate?: () => Promise<void>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createInstructionsAction?: ((input: CreateDraftInstructionsIn) => Promise<CreateDraftInstructionsOut>) | undefined;
  link_tool_id?: string | null; // Tool ID for linking existing resources
  linkInstructionsAction?: ((input: LinkInstructionsIn) => Promise<LinkInstructionsOut>) | undefined;
  searchTerm?: string; // Search term for filtering instructions
  onSearchChange?: (term: string) => void; // Callback when search term changes
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ instructions_id: string | null } | void>) => void;
  // Legacy props for backward compatibility
  instructionsResource?: { id: string; template: string; generated?: boolean | null } | null;
  instructionsId?: string | null;
  suggestions?: string[];
}

export function Instructions({
  instructions_id,
  instructions_resource,
  show_instructions = true,
  instructions_suggestions,
  instructions,
  disabled = false,
  onInstructionsIdChange,
  onGenerate,
  label = "Instructions",
  placeholder = "Enter instructions",
  required = false,
  rows = 8,
  id = "instructions",
  "data-testid": dataTestId,
  helpText,
  group_id,
  create_tool_id,
  showAiGenerate = false,
  createInstructionsAction,
  link_tool_id,
  linkInstructionsAction,
  searchTerm,
  onSearchChange,
  isAutosaveEnabled = true,
  registerFlush,
  // Legacy props for backward compatibility
  instructionsResource,
  instructionsId,
  suggestions,
}: InstructionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = instructions_resource ?? instructionsResource ?? null;
  const resourceId = instructions_id ?? instructionsId ?? null;
  const show = show_instructions ?? true;
  const suggestionsList = useMemo(
    () => instructions_suggestions ?? suggestions ?? [],
    [instructions_suggestions, suggestions]
  );

  // Handle nullable resource properties
  const resourceTemplate = resource?.template ?? "";
  const [internalValue, setInternalValue] = useState(resourceTemplate);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceTemplate);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);
  const isDirtyRef = useRef(false);
  const lastServerTextRef = useRef<string>(resourceTemplate);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ instructions_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ instructions_id: string | null } | void> => {
    // Skip if no action available
    if (!createInstructionsAction || !group_id) return;

    // Skip if no change AND we already have a resource for this value
    // If resourceId is null, we still need to create the resource even if value hasn't changed
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { instructions_id: resourceId };
    }

    const seq = ++saveSeqRef.current;
    try {
      if (internalValue.trim()) {
        const result = await createInstructionsAction({
          body: {
            group_id: group_id,
            template: internalValue,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (seq !== saveSeqRef.current) return;
        if (result.instruction_id) {
          onInstructionsIdChange(result.instruction_id);
          lastSavedValueRef.current = internalValue;
          isDirtyRef.current = false;
          return { instructions_id: result.instruction_id };
        }
      } else {
        if (seq !== saveSeqRef.current) return;
        onInstructionsIdChange(null);
        lastSavedValueRef.current = internalValue;
        isDirtyRef.current = false;
        return { instructions_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create instructions resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

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

  // Debounced resource creation - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Skip if no action
    if (!createInstructionsAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createInstructionsAction, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
  }, []);

  // AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "instructions",
    groupId: group_id,
  });

  // AI diff view state
  const showDiff = !!aiSuggestion?.template;
  const currentText = internalValue || "";
  const aiText = aiSuggestion?.template || "";

  // Accept AI suggestion - update internal value and notify parent
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveSeqRef.current += 1;
    const text = aiSuggestion.template || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    lastServerTextRef.current = text;
    isDirtyRef.current = false;
    onInstructionsIdChange(aiSuggestion.id);
    clearAi();
  }, [aiSuggestion, onInstructionsIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Use instructions array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (instructions && instructions.length > 0) {
      const mapping: Record<string, { id: string; template: string; generated: boolean | null }> = {};
      instructions.forEach((inst) => {
        if (inst.id) {
          mapping[inst.id] = {
            id: inst.id,
            template: inst.template || `Instructions ${inst.id.slice(0, 8)}...`,
            generated: inst.generated,
          };
        }
      });
      return mapping;
    }
    // Fallback: create placeholder mapping from suggestion IDs
    const mapping: Record<string, { id: string; template: string; generated: boolean | null }> = {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        template: `Instructions ${suggestionId.slice(0, 8)}...`,
        generated: null,
      };
    });
    return mapping;
  }, [instructions, suggestionsList]);
  
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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {resource?.generated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
              // Fire link tracking for selecting an existing resource
              if (linkInstructionsAction && group_id && link_tool_id) {
                linkInstructionsAction({
                  body: { resource_id: selectedId, group_id, tool_id: link_tool_id },
                }).catch(() => {});
              }
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
      {/* Conditional: DiffView when AI suggestion pending, otherwise Textarea */}
      {showDiff ? (
        <DiffView current={currentText} proposed={aiText} rows={rows} />
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
