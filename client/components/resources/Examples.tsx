/**
 * Examples.tsx
 * Resource component for example messages
 * Uses ReorderableList for UI, creates example resources, reports IDs to parent
 */

"use client";

import { ReorderableList } from "@/components/common/forms/ReorderableList";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LinkExamplesIn = InputOf<"/api/v5/resources/examples/link", "post">;
type LinkExamplesOut = OutputOf<"/api/v5/resources/examples/link", "post">;

// Derive resource item type from the GET endpoint response
type ExampleGetResponse = OutputOf<"/api/v5/resources/examples/get", "post">;
export type ExampleResourceItem = NonNullable<ExampleGetResponse["items"]>[number];

export interface ExamplesProps {
  example_ids?: string[]; // Current example resource IDs (standardized prop name)
  example_resources?: ExampleResourceItem[]; // Selected example resources (each includes generated field)
  show_examples?: boolean; // Whether to show this resource picker
  example_suggestions?: string[]; // Array of suggested example IDs (UUIDs) - consistent with other suggestions
  examples?: ExampleResourceItem[]; // All available examples from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update example_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for linking existing resources
  linkExamplesAction?:
    | ((input: LinkExamplesIn) => Promise<LinkExamplesOut>)
    | undefined;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  createExamplesAction?:
    | ((input: {
        body: {
          group_id: string;
          example: string;
          mcp?: boolean;
        };
      }) => Promise<{ example_id?: string | null }>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  // Optional: mapping of example_id -> example text (for initial display)
  exampleMapping?: Record<string, string>;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ example_ids: string[] } | void>) => void;
  // Legacy props for backward compatibility
  exampleIds?: string[];
  suggestions?: string[]; // History suggestions for autocomplete (legacy)
  aiExampleResources?: Pick<ExampleResourceItem, "id" | "example">[] | null;
}

export function Examples({
  example_ids,
  example_resources: _example_resources,
  show_examples = false,
  example_suggestions,
  examples,
  disabled = false,
  onChange,
  label = "Example Messages",
  id = "examples",
  required = false,
  maxItems = 10,
  addButtonLabel = "Add example",
  itemPlaceholder = "Message",
  group_id,
  create_tool_id,
  link_tool_id,
  linkExamplesAction,
  showAiGenerate = false,
  createExamplesAction,
  onGenerate,
  exampleMapping = {},
  isAutosaveEnabled = true,
  registerFlush,
  // Legacy props for backward compatibility
  exampleIds,
  suggestions = [],
  aiExampleResources: _aiExampleResources,
}: ExamplesProps) {
  // Use standardized props with fallback to legacy props
  const ids = useMemo(
    () => example_ids ?? exampleIds ?? [],
    [example_ids, exampleIds]
  );
  const show = show_examples ?? false;
  const allExamples = useMemo(() => examples ?? [], [examples]);

  // Build exampleMapping from examples array if not provided
  const effectiveExampleMapping = useMemo(() => {
    if (Object.keys(exampleMapping).length > 0) {
      return exampleMapping;
    }
    // Build mapping from examples array (example_id -> example text)
    // Note: This requires example_ids to match examples array order
    const mapping: Record<string, string> = {};
    ids.forEach((id, idx) => {
      const example = allExamples[idx];
      if (example?.example) {
        mapping[id] = example.example;
      }
    });
    return mapping;
  }, [exampleMapping, ids, allExamples]);

  // Convert example_suggestions (UUIDs) to example strings by looking them up
  // Use effectiveExampleMapping which maps example_id -> example text from current persona's examples
  // Note: This only works for suggestions that are in the current persona's examples array
  // For suggestions from other personas, they won't appear until those examples are added to current persona
  const suggestionsList = useMemo(() => {
    if (example_suggestions && example_suggestions.length > 0) {
      // Look up example text from suggestion IDs using the mapping
      return example_suggestions
        .map((id) => effectiveExampleMapping[id])
        .filter(
          (text): text is string =>
            text !== null && text !== undefined && text.trim() !== ""
        );
    }
    return suggestions;
  }, [example_suggestions, effectiveExampleMapping, suggestions]);

  // Reverse map: suggestion text -> existing resource ID (for linking instead of creating)
  const suggestionTextToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (example_suggestions && example_suggestions.length > 0) {
      for (const suggestionId of example_suggestions) {
        const text = effectiveExampleMapping[suggestionId];
        if (text && text.trim()) {
          map.set(text, suggestionId);
        }
        // Also check allExamples array for text->id mapping
        const exampleObj = allExamples.find((e) => e.id === suggestionId);
        if (exampleObj?.example && exampleObj.example.trim()) {
          map.set(exampleObj.example, suggestionId);
        }
      }
    }
    return map;
  }, [example_suggestions, effectiveExampleMapping, allExamples]);

  // Internal state for display texts (synced with example_ids via exampleMapping)
  const [internalTexts, setInternalTexts] = useState<string[]>(() => {
    // Initialize from example_ids using effectiveExampleMapping
    if (ids.length > 0 && Object.keys(effectiveExampleMapping).length > 0) {
      return ids
        .map((id) => effectiveExampleMapping[id] || "")
        .filter((text) => text.trim() !== "");
    }
    return [""];
  });

  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSavedTextsRef = useRef<string[]>(internalTexts);
  const lastReportedIdsRef = useRef<string[]>(ids); // Track last IDs reported to parent
  const isInitialMountRef = useRef(true);
  const exampleIdMapRef = useRef<Map<string, string>>(new Map()); // Maps example text -> example_id
  const onChangeRef = useRef(onChange); // Stable ref to avoid useEffect dependency
  onChangeRef.current = onChange;

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ example_ids: string[] } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ example_ids: string[] } | void> => {
    if (!createExamplesAction || !group_id) return;

    // Find texts that need creation (have text but no ID)
    const textsToCreate = internalTexts.filter(
      (text) => text.trim() && !exampleIdMapRef.current.has(text)
    );

    // Create resources for each
    for (const text of textsToCreate) {
      try {
        const result = await createExamplesAction({
          body: {
            group_id: group_id,
            example: text,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (result.example_id) {
          exampleIdMapRef.current.set(text, result.example_id);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create example: "${text}"`, error);
        throw error;
      }
    }

    // Update parent with all IDs
    const allIds = internalTexts
      .filter((t) => t.trim())
      .map((t) => exampleIdMapRef.current.get(t))
      .filter((id): id is string => id !== undefined);

    lastReportedIdsRef.current = allIds;
    onChangeRef.current(allIds);
    lastSavedTextsRef.current = internalTexts;

    return { example_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Sync external example_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveExampleMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveExampleMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        // Only update if texts actually changed to prevent infinite loops
        const newTexts = texts.length > 0 ? texts : [""];
        setInternalTexts((prev) => {
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(newTexts);
          if (prevStr === newStr) return prev;
          return newTexts;
        });
        // Update mapping
        ids.forEach((id, idx) => {
          if (texts[idx]) {
            exampleIdMapRef.current.set(texts[idx], id);
          }
        });
        // Keep lastReportedIdsRef in sync with external ids
        lastReportedIdsRef.current = ids;
      }
    }
  }, [ids, effectiveExampleMapping]);

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

    const hasPendingChanges =
      JSON.stringify(internalTexts) !== JSON.stringify(lastSavedTextsRef.current);
    if (hasPendingChanges) {
      // Notify save context that there are unsaved changes
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalTexts, isAutosaveEnabled]);

  // Debounced resource creation for each example text - only when autosave is enabled
  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedTextsRef.current = internalTexts;
      return;
    }

    // Clear all existing timers
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();

    // Check if there are any texts that need creation
    const hasTextsToCreate = internalTexts.some(
      (text) => text.trim() && !exampleIdMapRef.current.has(text)
    );

    if (!hasTextsToCreate) {
      // All texts already have IDs, update parent only if IDs changed (reorder/delete)
      const allIds = internalTexts
        .filter((t) => t.trim())
        .map((t) => exampleIdMapRef.current.get(t))
        .filter((id): id is string => id !== undefined);
      // Only call onChange if IDs actually changed to prevent infinite loops
      const lastReportedStr = JSON.stringify(lastReportedIdsRef.current);
      const newIdsStr = JSON.stringify(allIds);
      if (lastReportedStr !== newIdsStr) {
        lastReportedIdsRef.current = allIds;
        onChangeRef.current(allIds);
      }
      return;
    }

    // Debounce the flush
    const timer = setTimeout(() => {
      flushRef.current?.();
    }, 1000);

    debounceTimersRef.current.set(0, timer);

    lastSavedTextsRef.current = internalTexts;

    // Capture ref value at effect start for cleanup
    const timersAtStart = debounceTimersRef.current;

    return () => {
      // Use captured ref value for cleanup
      timersAtStart.forEach((timer) => clearTimeout(timer));
      timersAtStart.clear();
    };
  // Note: onChange is accessed via onChangeRef to avoid dependency issues
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalTexts, createExamplesAction, isAutosaveEnabled]);

  const handleItemsChange = useCallback((items: string[]) => {
    const newItems = items.length > 0 ? items : [""];
    // Check for newly added texts that match existing suggestions — link instead of create
    for (const text of newItems) {
      if (text.trim() && !exampleIdMapRef.current.has(text)) {
        const existingId = suggestionTextToIdMap.get(text);
        if (existingId) {
          // Map the text to the existing resource ID so flush skips creation
          exampleIdMapRef.current.set(text, existingId);
          // Fire link tracking
          if (linkExamplesAction && group_id && link_tool_id) {
            linkExamplesAction({
              body: { resource_id: existingId, group_id, tool_id: link_tool_id },
            }).catch(() => {});
          }
        }
      }
    }
    setInternalTexts(newItems);
  }, [suggestionTextToIdMap, linkExamplesAction, group_id, link_tool_id]);

  // AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "examples",
    groupId: group_id,
    accumulate: true,
  });

  // Check if any example resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _example_resources?.some((e) => e.generated) ?? false;
  }, [_example_resources]);

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;

  // Accept AI suggestion - add AI-suggested examples to internal texts
  const handleAccept = useCallback(() => {
    if (!aiSuggestions.length) return;
    // Add AI examples to internal texts
    const newTexts = aiSuggestions
      .map((e) => e.example)
      .filter((text): text is string => !!text);
    if (newTexts.length > 0) {
      setInternalTexts((prev) => [...prev.filter((t) => t.trim()), ...newTexts]);
      // Map the new example IDs
      aiSuggestions.forEach((e) => {
        if (e.id && e.example) {
          exampleIdMapRef.current.set(e.example, e.id);
        }
      });
    }
    clearAi();
  }, [aiSuggestions, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_examples is false (AFTER all hooks)
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
                  {hasGenerated ? "Regenerate" : "Generate"}
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
      )}
      {/* AI-suggested examples preview */}
      {showDiff && aiSuggestions.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Examples</p>
          <div className="space-y-2">
            {aiSuggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.example || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <ReorderableList
        items={internalTexts}
        onItemsChange={handleItemsChange}
        suggestions={suggestionsList}
        maxItems={maxItems}
        addButtonLabel={addButtonLabel}
        disabled={disabled}
        itemPlaceholder={itemPlaceholder}
      />
    </div>
  );
}
