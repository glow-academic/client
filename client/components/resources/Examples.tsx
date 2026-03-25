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
import { useResourceAi } from "@/hooks/use-resource-ai";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ExampleResourceItem {
  id?: string | null;
  example?: string | null;
  generated?: boolean | null;
}

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
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  onGenerate?: () => void | Promise<void>;
  // Optional: mapping of example_id -> example text (for initial display)
  exampleMapping?: Record<string, string>;
  onExamplesChange?: (examples: string[]) => void; // Report raw text values upward
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
  onChange: _onChange,
  label = "Example Messages",
  id = "examples",
  required = false,
  maxItems = 10,
  addButtonLabel = "Add example",
  itemPlaceholder = "Message",
  group_id,
  create_tool_id: _create_tool_id,
  showAiGenerate = false,
  onGenerate,
  exampleMapping = {},
  onExamplesChange,
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
