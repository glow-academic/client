/**
 * Examples.tsx
 * Pure UI component for example messages
 * Uses ReorderableList for UI, reports value changes upward via onExamplesChange
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
import { Check, PlusCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ExampleResourceItem {
  id?: string | null;
  example?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ExamplesProps {
  example_ids?: string[]; // Current example resource IDs (standardized prop name)
  example_resources?: ExampleResourceItem[]; // Selected example resources (each includes generated field)
  show_examples?: boolean; // Whether to show this resource picker
  examples?: ExampleResourceItem[]; // All available examples from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update example_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  // Optional: mapping of example_id -> example text (for initial display)
  exampleMapping?: Record<string, string>;
  onExamplesChange?: (examples: string[]) => void; // Report raw text values upward
  // Legacy props for backward compatibility
  exampleIds?: string[];
}

export function Examples({
  example_ids,
  example_resources: _example_resources,
  show_examples = false,
  examples,
  disabled = false,
  onChange: _onChange,
  label = "Example Messages",
  id = "examples",
  required = false,
  maxItems = 10,
  addButtonLabel = "Add example",
  itemPlaceholder = "Message",
  exampleMapping = {},
  onExamplesChange,
  // Legacy props for backward compatibility
  exampleIds,
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

  // Get suggested example texts from items with suggested=true
  const suggestionsList = useMemo(() => {
    return allExamples
      .filter((e) => e.suggested && e.example && e.example.trim() !== "")
      .map((e) => e.example!);
  }, [allExamples]);

  // Reverse map: suggestion text -> existing resource ID (for linking instead of creating)
  const suggestionTextToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    allExamples
      .filter((e) => e.suggested && e.id && e.example && e.example.trim())
      .forEach((e) => {
        map.set(e.example!, e.id!);
      });
    return map;
  }, [allExamples]);

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

  const isInitialMountRef = useRef(true);
  const exampleIdMapRef = useRef<Map<string, string>>(new Map()); // Maps example text -> example_id
  const onExamplesChangeRef = useRef(onExamplesChange);
  onExamplesChangeRef.current = onExamplesChange;

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
      }
    }
  }, [ids, effectiveExampleMapping]);

  // Report example text changes upward via onExamplesChange
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const currentTexts = internalTexts.filter((t) => t.trim());
    onExamplesChangeRef.current?.([...currentTexts]);
  }, [internalTexts]);

  const handleItemsChange = useCallback((items: string[]) => {
    const newItems = items.length > 0 ? items : [""];
    // Check for newly added texts that match existing suggestions
    for (const text of newItems) {
      if (text.trim() && !exampleIdMapRef.current.has(text)) {
        const existingId = suggestionTextToIdMap.get(text);
        if (existingId) {
          exampleIdMapRef.current.set(text, existingId);
        }
      }
    }
    setInternalTexts(newItems);
  }, [suggestionTextToIdMap]);

  // Pending items: examples with pending=true from the API
  const pendingItems = useMemo(() => {
    return allExamples.filter((e) => e.pending);
  }, [allExamples]);
  const pendingIds = useMemo(() => {
    return new Set(pendingItems.map((e) => e.id).filter((id): id is string => !!id));
  }, [pendingItems]);
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection, just confirm (no-op for form state)
  const handleAccept = useCallback(() => {
    // Pending items are already in the selection; accepting is a no-op for form state.
    // The parent will clear the pending flag on the server side.
  }, []);

  // Reject pending — remove pending item IDs from selection
  const handleReject = useCallback(() => {
    const currentIds = ids.filter((id) => !pendingIds.has(id));
    _onChange(currentIds);
  }, [ids, pendingIds, _onChange]);

  // Don't render if show_examples is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
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
          {internalTexts.length < maxItems && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleItemsChange([...internalTexts, ""])}
              disabled={disabled}
            >
              {addButtonLabel} <PlusCircle className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
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
        hideAddButton
      />
    </div>
  );
}
