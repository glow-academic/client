/**
 * Examples.tsx
 * Resource component for example messages
 * Uses ReorderableList for UI, creates example resources, reports IDs to parent
 */

"use client";

import { ReorderableList } from "@/components/common/forms/ReorderableList";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ExamplesProps {
  example_ids?: string[]; // Current example resource IDs (standardized prop name)
  example_resources?: Array<{
    example: string | null;
    idx: number | null;
    generated?: boolean | null;
  }>; // Selected example resources (each includes generated field)
  show_examples?: boolean; // Whether to show this resource picker
  example_suggestions?: string[]; // Array of suggested example IDs (UUIDs) - consistent with other suggestions
  examples?: Array<{
    example: string | null;
    idx: number | null;
    generated?: boolean | null;
  }>; // All available examples from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update example_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createExamplesAction?:
    | ((input: {
        body: { agent_id: string; group_id: string; example: string };
      }) => Promise<{ example_id?: string | null }>)
    | undefined;
  // Optional: mapping of example_id -> example text (for initial display)
  exampleMapping?: Record<string, string>;
  // Legacy props for backward compatibility
  exampleIds?: string[];
  suggestions?: string[]; // History suggestions for autocomplete (legacy)
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
  agent_id,
  createExamplesAction,
  exampleMapping = {},
  // Legacy props for backward compatibility
  exampleIds,
  suggestions = [],
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

  // Filter examples to remove nulls - use validExamples for validation/filtering
  const validExamples = useMemo(() => {
    return allExamples.filter((ex) => ex.example !== null && ex.idx !== null);
  }, [allExamples]);

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

  // Use validExamples to filter display examples (if needed)
  const _displayExamples = useMemo(() => {
    return validExamples;
  }, [validExamples]);

  // Use example_resources to display example content (if needed)
  const _exampleResources = _example_resources ?? [];

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
  const isInitialMountRef = useRef(true);
  const exampleIdMapRef = useRef<Map<string, string>>(new Map()); // Maps example text -> example_id

  // Sync external example_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveExampleMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveExampleMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        setInternalTexts(texts.length > 0 ? texts : [""]);
        // Update mapping
        ids.forEach((id, idx) => {
          if (texts[idx]) {
            exampleIdMapRef.current.set(texts[idx], id);
          }
        });
      }
    }
  }, [ids, effectiveExampleMapping]);

  // Debounced resource creation for each example text
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedTextsRef.current = internalTexts;
      return;
    }

    // Clear all existing timers
    debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    debounceTimersRef.current.clear();

    // Create/update resources for each text
    const newExampleIds: string[] = [];
    // Use promises to track async operations
    const promises: Promise<void>[] = [];

    internalTexts.forEach((text, index) => {
      if (!text.trim()) {
        // Skip empty texts
        return;
      }

      // Check if we already have an ID for this text
      const existingId = exampleIdMapRef.current.get(text);
      if (existingId) {
        newExampleIds.push(existingId);
        return;
      }

      // Debounce creation for this text
      const promise = (async () => {
        if (createExamplesAction && agent_id && group_id) {
          try {
            const result = await createExamplesAction({
              body: { agent_id: agent_id, group_id: group_id, example: text },
            });
            if (result.example_id) {
              exampleIdMapRef.current.set(text, result.example_id);
              // Update parent with all IDs
              const allIds = internalTexts
                .map((t) => {
                  if (!t.trim()) return null;
                  return exampleIdMapRef.current.get(t) || null;
                })
                .filter((id): id is string => id !== null);
              onChange(allIds);
            }
          } catch (error) {
            console.error(
              `Failed to create example resource for "${text}":`,
              error
            );
          }
        }
      })();
      promises.push(promise);

      const timer = setTimeout(() => {
        // Timer just tracks the debounce, promise handles the actual work
      }, 1000);

      debounceTimersRef.current.set(index, timer);
    });

    lastSavedTextsRef.current = internalTexts;

    return () => {
      // Capture current ref value before cleanup to avoid stale closure
      const timers = debounceTimersRef.current;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [internalTexts, createExamplesAction, onChange]);

  const handleItemsChange = useCallback((items: string[]) => {
    setInternalTexts(items.length > 0 ? items : [""]);
  }, []);

  // Don't render if show_examples is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
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
