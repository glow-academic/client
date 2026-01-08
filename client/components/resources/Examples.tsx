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
  exampleIds: string[]; // Current example resource IDs from form state
  onChange: (ids: string[]) => void; // Update example_ids in form state
  suggestions?: string[]; // History suggestions for autocomplete
  label?: string;
  disabled?: boolean;
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
}

export function Examples({
  exampleIds,
  onChange,
  suggestions = [],
  label = "Example Messages",
  disabled = false,
  id = "examples",
  maxItems = 10,
  addButtonLabel = "Add example",
  itemPlaceholder = "Message",
  createExamplesAction,
  exampleMapping = {},
}: ExamplesProps) {
  // Internal state for display texts (synced with exampleIds via exampleMapping)
  const [internalTexts, setInternalTexts] = useState<string[]>(() => {
    // Initialize from exampleIds using exampleMapping
    if (exampleIds.length > 0 && Object.keys(exampleMapping).length > 0) {
      return exampleIds
        .map((id) => exampleMapping[id] || "")
        .filter((text) => text.trim() !== "");
    }
    return [""];
  });

  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSavedTextsRef = useRef<string[]>(internalTexts);
  const isInitialMountRef = useRef(true);
  const exampleIdMapRef = useRef<Map<string, string>>(new Map()); // Maps example text -> example_id

  // Sync external exampleIds changes (when loading from server)
  useEffect(() => {
    if (exampleIds.length > 0 && Object.keys(exampleMapping).length > 0) {
      const texts = exampleIds
        .map((id) => exampleMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        setInternalTexts(texts.length > 0 ? texts : [""]);
        // Update mapping
        exampleIds.forEach((id, idx) => {
          if (texts[idx]) {
            exampleIdMapRef.current.set(texts[idx], id);
          }
        });
      }
    }
  }, [exampleIds, exampleMapping]);

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
        suggestions={suggestions}
        maxItems={maxItems}
        addButtonLabel={addButtonLabel}
        disabled={disabled}
        itemPlaceholder={itemPlaceholder}
      />
    </div>
  );
}
