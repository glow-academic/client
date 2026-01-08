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
  example_resources?: Array<{ example: string | null; idx: number | null }>; // Selected example resources
  show_examples?: boolean; // Whether to show this resource picker
  example_suggestions?: string[]; // Array of suggested example IDs (UUIDs) - consistent with other suggestions
  examples?: Array<{ example: string | null; idx: number | null }>; // All available examples from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update example_ids in form state
  label?: string;
  id?: string;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  createExamplesAction?:
    | ((input: {
        body: { example: string };
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
  example_resources,
  show_examples = false,
  example_suggestions,
  examples,
  disabled = false,
  onChange,
  label = "Example Messages",
  id = "examples",
  maxItems = 10,
  addButtonLabel = "Add example",
  itemPlaceholder = "Message",
  createExamplesAction,
  exampleMapping = {},
  // Legacy props for backward compatibility
  exampleIds,
  suggestions = [],
}: ExamplesProps) {
  // Use standardized props with fallback to legacy props
  const ids = example_ids ?? exampleIds ?? [];
  const show = show_examples ?? false;
  const allExamples = examples ?? [];
  
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

  // Filter examples to remove nulls
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
        .filter((text): text is string => text !== null && text !== undefined && text.trim() !== "");
    }
    return suggestions;
  }, [example_suggestions, effectiveExampleMapping, suggestions]);

  // Don't render if show_examples is false
  if (!show) {
    return null;
  }

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
      const timer = setTimeout(async () => {
        if (createExamplesAction) {
          try {
            const result = await createExamplesAction({
              body: { example: text },
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
            console.error(`Failed to create example resource for "${text}":`, error);
          }
        }
      }, 1000);

      debounceTimersRef.current.set(index, timer);
    });

    lastSavedTextsRef.current = internalTexts;

    return () => {
      debounceTimersRef.current.forEach((timer) => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, [internalTexts, createExamplesAction, onChange]);

  const handleItemsChange = useCallback(
    (items: string[]) => {
      setInternalTexts(items.length > 0 ? items : [""]);
    },
    []
  );

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}
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
