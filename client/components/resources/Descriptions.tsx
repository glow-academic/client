/**
 * Descriptions.tsx
 * Resource component for description textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;

// Derive resource item type from the GET endpoint response
type DescriptionsGetResponse = OutputOf<"/api/v4/resources/descriptions/get", "post">;
export type DescriptionResourceItem = NonNullable<DescriptionsGetResponse["items"]>[number];

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

export interface DescriptionsProps {
  description_id?: string | null; // Current description_id (standardized prop name)
  description_resource?: DescriptionResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_description?: boolean; // Whether to show this resource picker
  description_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  descriptions?: DescriptionResourceItem[]; // Array of suggested description resources (only suggested options, not all)
  disabled?: boolean; // Based on can_edit flag
  onDescriptionIdChange: (descriptionId: string | null) => void; // Update description_id in parent form state
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
  createDescriptionsAction?:
    | ((
        input: CreateDraftDescriptionsIn
      ) => Promise<CreateDraftDescriptionsOut>)
    | undefined;
  searchTerm?: string; // Search term for filtering descriptions
  onSearchChange?: (term: string) => void; // Callback when search term changes
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ description_id: string | null } | void>) => void;
}

export function Descriptions({
  description_id,
  description_resource,
  show_description = true,
  description_suggestions,
  descriptions,
  disabled = false,
  onDescriptionIdChange,
  onGenerate,
  label = "Description",
  placeholder = "Enter description",
  required = false,
  rows = 4,
  id = "description",
  "data-testid": dataTestId,
  helpText,
  group_id,
  create_tool_id,
  showAiGenerate = false,
  createDescriptionsAction,
  searchTerm,
  onSearchChange,
  isAutosaveEnabled = true,
  registerFlush,
}: DescriptionsProps) {
  const resource = description_resource ?? null;
  const resourceId = description_id ?? null;
  const show = show_description ?? true;
  const suggestionsList = useMemo(
    () => description_suggestions ?? [],
    [description_suggestions]
  );

  // Handle nullable resource properties - normalize to string
  const resourceDescription = resource?.description ?? "";
  const [internalValue, setInternalValue] = useState(resourceDescription);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceDescription);
  const isInitialMountRef = useRef(true);
  const saveSeqRef = useRef(0);

  // Track whether user has diverged from last saved value
  const isDirtyRef = useRef(false);

  // Keep a stable "server identity" for when we should accept server as source of truth
  const lastServerTextRef = useRef<string>(resourceDescription);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ description_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ description_id: string | null } | void> => {
    // Skip if no action available
    if (!createDescriptionsAction || !group_id) return;

    // Skip if no change AND we already have a resource for this value
    // If resourceId is null, we still need to create the resource even if value hasn't changed
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { description_id: resourceId };
    }

    const seq = ++saveSeqRef.current;
    try {
      if (internalValue.trim()) {
        const result = await createDescriptionsAction({
          body: {
            group_id: group_id,
            description: internalValue,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (seq !== saveSeqRef.current) return;
        if (result.description_id) {
          onDescriptionIdChange(result.description_id);
          lastSavedValueRef.current = internalValue;
          isDirtyRef.current = false;
          return { description_id: result.description_id };
        }
      } else {
        if (seq !== saveSeqRef.current) return;
        onDescriptionIdChange(null);
        lastSavedValueRef.current = internalValue;
        isDirtyRef.current = false;
        return { description_id: null };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create description resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const descriptionsById = useMemo(() => {
    const mapping: Record<string, string> = {};
    (descriptions ?? []).forEach((desc) => {
      if (desc.id && desc.description) {
        mapping[desc.id] = desc.description;
      }
    });
    return mapping;
  }, [descriptions]);

  // Update internal value when description_resource changes
  // Only sync if server text actually changed AND user is not actively editing
  useEffect(() => {
    const mappedValue = resourceId ? descriptionsById[resourceId] : undefined;
    const hasServerValue =
      resourceDescription !== "" || mappedValue !== undefined || resourceId === null;
    if (!hasServerValue) return;
    const serverValue =
      resourceDescription !== "" ? resourceDescription : mappedValue ?? "";

    // If server is pushing the same text again, ignore.
    if (serverValue === lastServerTextRef.current) return;

    // If user is editing (dirty), do NOT clobber their input.
    // Only sync if we are not dirty.
    if (!isDirtyRef.current) {
      setInternalValue(serverValue);
      lastSavedValueRef.current = serverValue;
    }

    lastServerTextRef.current = serverValue;
  }, [resourceDescription, resourceId, descriptionsById]);

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
    if (!createDescriptionsAction) {
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
  }, [internalValue, createDescriptionsAction, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;
  }, []);

  // AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "descriptions",
    groupId: group_id,
  });

  // AI diff view state
  const showDiff = !!aiSuggestion?.description;
  const currentText = internalValue || "";
  const aiText = aiSuggestion?.description || "";

  // Accept AI suggestion - update internal value and notify parent
  const handleAccept = useCallback(() => {
    if (!aiSuggestion?.id) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveSeqRef.current += 1;
    const text = aiSuggestion.description || "";
    setInternalValue(text);
    lastSavedValueRef.current = text;
    lastServerTextRef.current = text;
    isDirtyRef.current = false;
    onDescriptionIdChange(aiSuggestion.id);
    clearAi();
  }, [aiSuggestion, onDescriptionIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Use descriptions array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (descriptions && descriptions.length > 0) {
      const mapping: Record<string, { id: string; description: string }> = {};
      descriptions.forEach((desc) => {
        if (desc.id) {
          mapping[desc.id] = {
            id: desc.id,
            description:
              desc.description || `Description ${desc.id.slice(0, 8)}...`,
          };
        }
      });
      return mapping;
    }
    // Fallback: create placeholder mapping from suggestion IDs
    const mapping: Record<string, { id: string; description: string }> = {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        description: `Description ${suggestionId.slice(0, 8)}...`,
      };
    });
    return mapping;
  }, [descriptions, suggestionsList]);

  // Use descriptions array for GenericPicker items if available
  // Transform to ensure id and description are non-null for GenericPicker
  const pickerItems = useMemo(() => {
    if (descriptions && descriptions.length > 0) {
      return descriptions
        .filter((d) => d.id != null && d.description != null)
        .map((d) => ({
          id: d.id!,
          description: d.description!,
          ...(d.generated !== undefined ? { generated: d.generated } : {}),
        }));
    }
    return Object.values(suggestionsMapping);
  }, [descriptions, suggestionsMapping]);

  // Don't render if show_description is false (AFTER all hooks)
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
              const nextValue = descriptionsById[selectedId] ?? "";
              setInternalValue(nextValue);
              lastSavedValueRef.current = nextValue;
              lastServerTextRef.current = nextValue;
            } else {
              setInternalValue("");
              lastSavedValueRef.current = "";
              lastServerTextRef.current = "";
            }
            isDirtyRef.current = false;
            onDescriptionIdChange(selectedId);
            // Clear any pending AI suggestion when picker selection changes
            if (showDiff) {
              clearAi();
            }
          }}
          getId={(item) => {
            if (typeof item === "string") {
              return item;
            }
            return item.id || "";
          }}
          getLabel={(
            item: { id: string | null; description: string | null } | string
          ) => {
            if (typeof item === "string") {
              return `Description ${item.slice(0, 8)}...`;
            }
            const desc = item.description;
            const id = item.id;
            if (desc && typeof desc === "string") return desc;
            if (id && typeof id === "string")
              return `Description ${id.slice(0, 8)}...`;
            return "Description";
          }}
          getSearchText={(
            item: { id: string | null; description: string | null } | string
          ) => {
            if (typeof item === "string") {
              return `Description ${item.slice(0, 8)}... ${item}`;
            }
            // Include ID in search text (hidden from user) to make items distinguishable internally
            const desc = item.description;
            const id = item.id;
            const descStr = desc && typeof desc === "string" ? desc : "";
            const idStr = id && typeof id === "string" ? id : "";
            return `${descStr} ${idStr}`;
          }}
          placeholder="Descriptions"
          disabled={disabled}
          multiSelect={false}
          compact={true}
          buttonClassName="h-8"
          showLabel={false}
          {...(searchTerm ? { initialSearchTerm: searchTerm } : {})}
          {...(onSearchChange ? { onSearchChange } : {})}
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
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
