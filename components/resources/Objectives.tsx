/**
 * Objectives.tsx
 * Resource component for objective messages
 * Redesigned to match ContentSection autocomplete dropdown pattern
 * Pure UI: data in, IDs out via onChange. Parent owns creation.
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
import { cn } from "@/lib/utils";
import { Check, GripVertical, PlusCircle, Target, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export interface ObjectiveResourceItem {
  objective_id?: string | null;
  objective?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

// ObjectiveInputWithAutocomplete component (ghost tab autocomplete)
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
  pending,
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
  pending?: boolean;
}) {
  const ghostMatch = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed || !suggestions.length) return null;
    const valueLower = trimmed.toLowerCase();
    return suggestions.find((s) => {
      const sLower = s.toLowerCase();
      return sLower.startsWith(valueLower) && sLower !== valueLower;
    }) ?? null;
  }, [suggestions, value]);

  const ghostSuffix = ghostMatch ? ghostMatch.slice(value.length) : "";

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && ghostSuffix) {
        e.preventDefault();
        onChange(ghostMatch!);
      }
    },
    [ghostSuffix, ghostMatch, onChange]
  );

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
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("flex-1", pending && "ring-2 ring-success bg-success/5")}
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()}
          />
          {ghostSuffix && !disabled && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 h-full flex items-center pointer-events-none text-sm px-3"
            >
              <span className="invisible">{value}</span>
              <span className="text-muted-foreground/40">{ghostSuffix}</span>
            </span>
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
  objective_resources?: ObjectiveResourceItem[]; // Selected objective resources (each includes generated field)
  show_objectives?: boolean; // Whether to show this resource picker
  objectives_required?: boolean; // Whether this resource is required
  objectives?: ObjectiveResourceItem[]; // All available objectives from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update objective_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  maxItems?: number;
  addButtonLabel?: string;
  itemPlaceholder?: string;
  // Optional: mapping of objective_id -> objective text (for initial display)
  objectiveMapping?: Record<string, string>;
  /** Report value changes upward (unified draft pattern — parent owns creation) */
  onObjectivesChange?: (objectives: string[]) => void;
  /** Per-field pending lifecycle (multi-select). See ParameterFields.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

export function Objectives({
  objective_ids,
  objective_resources: _objective_resources,
  show_objectives = false,
  objectives_required,
  objectives,
  disabled = false,
  onChange,
  label = "Objectives",
  id = "objectives",
  required = false,
  maxItems = 3, // Default to 3 like ContentSection
  addButtonLabel = "Add objective",
  itemPlaceholder = "Learning objective",
  objectiveMapping = {},
  onObjectivesChange,
  onAcceptPending,
  onRejectPending,
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

  // Derive suggestion strings from objectives array for ghost tab autocomplete
  const suggestionsList = useMemo(() => {
    return allObjectives
      .map((obj) => obj.objective)
      .filter((text): text is string => text !== null && text !== undefined && text.trim() !== "");
  }, [allObjectives]);

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

  const objectiveIdMapRef = useRef<Map<string, string>>(new Map()); // Maps objective text -> objective_id
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);
  // Dirty flag: once the user interacts, stop syncing from server data so we
  // don't clobber their input (same pattern as Descriptions.tsx / Examples.tsx).
  const isDirtyRef = useRef(false);

  // Sync external objective_ids changes (when loading from server). Skip while
  // the user is editing so their in-progress text isn't clobbered.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (ids.length > 0 && Object.keys(effectiveObjectiveMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveObjectiveMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        const newTexts = texts.length > 0 ? texts : [""];
        setInternalTexts((prev) => {
          const prevStr = JSON.stringify(prev);
          const newStr = JSON.stringify(newTexts);
          if (prevStr === newStr) return prev;
          return newTexts;
        });
        ids.forEach((id, idx) => {
          if (texts[idx]) {
            objectiveIdMapRef.current.set(texts[idx], id);
          }
        });
      }
    }
  }, [ids, effectiveObjectiveMapping]);

  const onObjectivesChangeRef = useRef(onObjectivesChange);
  onObjectivesChangeRef.current = onObjectivesChange;

  // Objective handlers (matching ContentSection pattern)
  const addObjective = useCallback(() => {
    if (internalTexts.length >= maxItems) {
      toast.error(`Maximum ${maxItems} objectives allowed`);
      return;
    }
    isDirtyRef.current = true;
    setInternalTexts((prev) => [...prev, ""]);
  }, [internalTexts.length, maxItems]);

  // Updaters must be PURE — calling the parent's setState inside a state
  // updater is a side effect and triggers "Cannot update a component while
  // rendering a different component" when React re-invokes the updater.
  // Instead compute next deterministically from a ref snapshot, set local
  // state, and notify the parent outside the updater.
  const internalTextsRef = useRef(internalTexts);
  internalTextsRef.current = internalTexts;

  const removeObjective = useCallback((index: number) => {
    isDirtyRef.current = true;
    const next = [...internalTextsRef.current];
    next.splice(index, 1);
    setInternalTexts(next);
    onObjectivesChangeRef.current?.(next.filter((t) => t.trim()));
  }, []);

  const updateObjective = useCallback((index: number, value: string) => {
    isDirtyRef.current = true;
    const next = [...internalTextsRef.current];
    next[index] = value;
    setInternalTexts(next);
    onObjectivesChangeRef.current?.(next.filter((t) => t.trim()));
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

  // Pending state: items with pending=true from the API
  const pendingItems = useMemo(
    () => allObjectives.filter((o) => o.pending === true),
    [allObjectives]
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((o) => o.objective_id).filter(Boolean) as string[]),
    [pendingItems]
  );
  const showDiff = pendingItems.length > 0;

  // Map pending IDs to internalTexts indices
  const pendingIndices = useMemo(() => {
    if (!showDiff) return undefined;
    const indices = new Set<number>();
    ids.forEach((id, idx) => {
      if (pendingIds.has(id) && idx < internalTexts.length) {
        indices.add(idx);
      }
    });
    return indices.size > 0 ? indices : undefined;
  }, [showDiff, ids, pendingIds, internalTexts.length]);

  // Accept pending — pending items already in selection; tell parent
  // hook to strip them from ``pending_ids`` if provided.
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingIds.size > 0) {
      onAcceptPending(Array.from(pendingIds));
    }
  }, [onAcceptPending, pendingIds]);

  // Reject pending — remove pending IDs from selection. Parent hook (if
  // present) also strips them from ``pending_ids``.
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingIds.size > 0) {
      onRejectPending(Array.from(pendingIds));
      return;
    }
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, onRejectPending, pendingIds]);

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
          pending={pendingIndices?.has(index)}
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
