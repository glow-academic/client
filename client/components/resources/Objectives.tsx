/**
 * Objectives.tsx
 * Resource component for objective messages
 * Redesigned to match ContentSection autocomplete dropdown pattern
 * Creates objective resources, reports IDs to parent
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, GripVertical, Loader2, PlusCircle, Sparkles, Target, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CreateDraftObjectivesIn = InputOf<"/api/v4/resources/objectives", "post">;
type CreateDraftObjectivesOut = OutputOf<
  "/api/v4/resources/objectives",
  "post"
>;

// ObjectiveInputWithAutocomplete component (matching ContentSection pattern)
function ObjectiveInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedObjectiveIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalObjectives,
  maxObjectives: _maxObjectives,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedObjectiveIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove?: () => void;
  totalObjectives: number;
  maxObjectives: number;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];
    const valueLower = value.toLowerCase().trim();
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        if (sLower === valueLower) return false;
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5);
    return matching;
  }, [suggestions, value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        draggedObjectiveIndex === index && "opacity-50"
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <div
          draggable={!disabled}
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()}
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Show delete button only if onRemove is provided and more than 1 objective */}
        {onRemove && totalObjectives > 1 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ObjectivesProps {
  objective_ids?: string[]; // Current objective resource IDs (standardized prop name)
  objective_resources?: Array<{
    id?: string | null;
    objective?: string | null;
    generated?: boolean | null;
  }>; // Selected objective resources (each includes generated field)
  show_objectives?: boolean; // Whether to show this resource picker
  objectives_required?: boolean; // Whether this resource is required
  objective_suggestions?: string[]; // Array of suggested objective IDs (UUIDs) - consistent with other suggestions
  objectives?: Array<{
    id?: string | null;
    objective?: string | null;
    generated?: boolean | null;
  }>; // All available objectives from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update objective_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createObjectivesAction?:
    | ((input: CreateDraftObjectivesIn) => Promise<CreateDraftObjectivesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Optional: mapping of objective_id -> objective text (for initial display)
  objectiveMapping?: Record<string, string>;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created IDs */
  registerFlush?: (flush: () => Promise<{ objective_ids: string[] } | void>) => void;
  // AI diff view props
  aiObjectiveResources?: Array<{
    objective_id?: string | null;
    objective?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Objectives({
  objective_ids,
  objective_resources: _objective_resources,
  show_objectives = false,
  objectives_required,
  objective_suggestions,
  objectives,
  disabled = false,
  onChange,
  label = "Objectives",
  id = "objectives",
  required = false,
  maxItems = 3, // Default to 3 like ContentSection
  addButtonLabel = "Add objective",
  itemPlaceholder = "Learning objective",
  group_id,
  create_tool_id,
  link_tool_id,
  createObjectivesAction,
  onGenerate,
  isGenerating = false,
  objectiveMapping = {},
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiObjectiveResources,
  onAccept,
  onReject,
}: ObjectivesProps) {
  // Use standardized props
  const ids = useMemo(() => objective_ids ?? [], [objective_ids]);
  const show = show_objectives ?? false;
  const allObjectives = useMemo(() => objectives ?? [], [objectives]);

  // Build objectiveMapping from objectives array if not provided
  const effectiveObjectiveMapping = useMemo(() => {
    if (Object.keys(objectiveMapping).length > 0) {
      return objectiveMapping;
    }
    // Build mapping from objectives array (objective_id -> objective text)
    // Note: This requires objective_ids to match objectives array order
    const mapping: Record<string, string> = {};
    ids.forEach((id, idx) => {
      const objective = allObjectives[idx];
      if (objective?.objective) {
        mapping[id] = objective.objective;
      }
    });
    return mapping;
  }, [objectiveMapping, ids, allObjectives]);

  // Convert objective_suggestions (UUIDs) to objective strings by looking them up
  const suggestionsList = useMemo(() => {
    if (objective_suggestions && objective_suggestions.length > 0) {
      // Look up objective text from suggestion IDs using the mapping
      return objective_suggestions
        .map((id) => effectiveObjectiveMapping[id])
        .filter(
          (text): text is string =>
            text !== null && text !== undefined && text.trim() !== ""
        );
    }
    // Also use objectives array directly if available
    return allObjectives
      .map((obj) => obj.objective)
      .filter((text): text is string => text !== null && text !== undefined && text.trim() !== "");
  }, [objective_suggestions, effectiveObjectiveMapping, allObjectives]);

  // Internal state for display texts (synced with objective_ids via objectiveMapping)
  const [internalTexts, setInternalTexts] = useState<string[]>(() => {
    // Initialize from objective_ids using effectiveObjectiveMapping
    if (ids.length > 0 && Object.keys(effectiveObjectiveMapping).length > 0) {
      return ids
        .map((id) => effectiveObjectiveMapping[id] || "")
        .filter((text) => text.trim() !== "");
    }
    return [""];
  });

  const debounceTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const lastSavedTextsRef = useRef<string[]>(internalTexts);
  const lastReportedIdsRef = useRef<string[]>(ids); // Track last IDs reported to parent
  const isInitialMountRef = useRef(true);
  const objectiveIdMapRef = useRef<Map<string, string>>(new Map()); // Maps objective text -> objective_id
  const onChangeRef = useRef(onChange); // Stable ref to avoid useEffect dependency
  onChangeRef.current = onChange;
  const flushRef = useRef<(() => Promise<{ objective_ids: string[] } | void>) | undefined>(undefined);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // Sync external objective_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveObjectiveMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveObjectiveMapping[id] || "")
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
            objectiveIdMapRef.current.set(texts[idx], id);
          }
        });
        // Keep lastReportedIdsRef in sync with external ids
        lastReportedIdsRef.current = ids;
      }
    }
  }, [ids, effectiveObjectiveMapping]);

  // Debounced resource creation for each objective text - only when autosave is enabled
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
      (text) => text.trim() && !objectiveIdMapRef.current.has(text)
    );

    if (!hasTextsToCreate) {
      // All texts already have IDs, update parent only if IDs changed (reorder/delete)
      const allIds = internalTexts
        .filter((t) => t.trim())
        .map((t) => objectiveIdMapRef.current.get(t))
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
  }, [internalTexts, createObjectivesAction, isAutosaveEnabled]);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ objective_ids: string[] } | void> => {
    if (!createObjectivesAction || !create_tool_id || !group_id) return;

    // Find texts that need creation (have text but no ID)
    const textsToCreate = internalTexts.filter(
      (text) => text.trim() && !objectiveIdMapRef.current.has(text)
    );

    // Create resources for each
    for (const text of textsToCreate) {
      try {
        const result = await createObjectivesAction({
          body: {
            group_id: group_id,
            objective: text,
            mcp: false,
          },
        });
        if (result.objective_id) {
          objectiveIdMapRef.current.set(text, result.objective_id);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to create objective: "${text}"`, error);
        throw error;
      }
    }

    // Update parent with all IDs
    const allIds = internalTexts
      .filter((t) => t.trim())
      .map((t) => objectiveIdMapRef.current.get(t))
      .filter((id): id is string => id !== undefined);

    lastReportedIdsRef.current = allIds;
    onChangeRef.current(allIds);
    lastSavedTextsRef.current = internalTexts;

    return { objective_ids: allIds };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Objective handlers (matching ContentSection pattern)
  const addObjective = useCallback(() => {
    if (internalTexts.length >= maxItems) {
      toast.error(`Maximum ${maxItems} objectives allowed`);
      return;
    }
    setInternalTexts((prev) => [...prev, ""]);
  }, [internalTexts.length, maxItems]);

  const removeObjective = useCallback((index: number) => {
    setInternalTexts((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const updateObjective = useCallback((index: number, value: string) => {
    setInternalTexts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleDragStartObjective = useCallback((e: React.DragEvent, index: number) => {
    setDraggedObjectiveIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOverObjective = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropObjective = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedObjectiveIndex === null) return;
    setInternalTexts((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggedObjectiveIndex, 1);
      next.splice(targetIndex, 0, removed || "");
      return next;
    });
    setDraggedObjectiveIndex(null);
  }, [draggedObjectiveIndex]);

  // Check if any objective resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _objective_resources?.some((o) => o.generated) ?? false;
  }, [_objective_resources]);

  // AI suggestion state
  const showDiff = !!aiObjectiveResources?.length;

  // Accept AI suggestion - add AI-suggested objectives to internal texts
  const handleAccept = useCallback(() => {
    if (!aiObjectiveResources?.length) return;
    // Add AI objectives to internal texts
    const newTexts = aiObjectiveResources
      .map((o) => o.objective)
      .filter((text): text is string => !!text);
    if (newTexts.length > 0) {
      setInternalTexts((prev) => [...prev.filter((t) => t.trim()), ...newTexts]);
      // Map the new objective IDs
      aiObjectiveResources.forEach((o) => {
        if (o.objective_id && o.objective) {
          objectiveIdMapRef.current.set(o.objective, o.objective_id);
        }
      });
    }
    onAccept?.();
  }, [aiObjectiveResources, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_objectives is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            {label}
            {(required || objectives_required) && (
              <span className="text-destructive">*</span>
            )}
          </Label>
          {onGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
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
      
      {/* AI-suggested objectives preview */}
      {showDiff && aiObjectiveResources && aiObjectiveResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Objectives</p>
          <div className="space-y-2">
            {aiObjectiveResources.map((item, idx) => (
              <div
                key={item.objective_id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.objective || ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objectives List (matching ContentSection pattern) */}
      {internalTexts.length === 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addObjective}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
      {internalTexts.map((objective, index) => (
        <ObjectiveInputWithAutocomplete
          key={`objective-${index}`}
          index={index}
          value={objective || ""}
          onChange={(value) => updateObjective(index, value)}
          placeholder={`${itemPlaceholder} ${index + 1}`}
          suggestions={suggestionsList}
          disabled={disabled}
          draggedObjectiveIndex={draggedObjectiveIndex}
          onDragStart={(e) => handleDragStartObjective(e, index)}
          onDragOver={handleDragOverObjective}
          onDrop={(e) => handleDropObjective(e, index)}
          {...(internalTexts.length > 1 && {
            onRemove: () => removeObjective(index),
          })}
          totalObjectives={internalTexts.length}
          maxObjectives={maxItems}
        />
      ))}

      {internalTexts.length < maxItems && internalTexts.length > 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={addObjective}
            disabled={disabled}
            size="sm"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> {addButtonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
