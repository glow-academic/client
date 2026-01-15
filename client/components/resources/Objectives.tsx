/**
 * Objectives.tsx
 * Resource component for objective messages
 * Uses ReorderableList for UI, creates objective resources, reports IDs to parent
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
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftObjectivesIn = InputOf<"/api/v4/resources/objectives", "post">;
type CreateDraftObjectivesOut = OutputOf<
  "/api/v4/resources/objectives",
  "post"
>;

export interface ObjectivesProps {
  objective_ids?: string[]; // Current objective resource IDs (standardized prop name)
  objective_resources?: Array<{
    objective: string | null;
    idx: number | null;
    generated?: boolean | null;
  }>; // Selected objective resources (each includes generated field)
  show_objectives?: boolean; // Whether to show this resource picker
  objectives_agent_id?: string | null; // Agent ID for resource creation
  objectives_required?: boolean; // Whether this resource is required
  objective_suggestions?: string[]; // Array of suggested objective IDs (UUIDs) - consistent with other suggestions
  objectives?: Array<{
    objective: string | null;
    idx: number | null;
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
  agent_id?: string | null; // Agent ID for resource creation
  createObjectivesAction?:
    | ((input: CreateDraftObjectivesIn) => Promise<CreateDraftObjectivesOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // Optional: mapping of objective_id -> objective text (for initial display)
  objectiveMapping?: Record<string, string>;
}

export function Objectives({
  objective_ids,
  objective_resources: _objective_resources,
  show_objectives = false,
  objectives_agent_id,
  objectives_required,
  objective_suggestions,
  objectives,
  disabled = false,
  onChange,
  label = "Objectives",
  id = "objectives",
  required = false,
  maxItems = 10,
  addButtonLabel = "Add objective",
  itemPlaceholder = "Objective",
  group_id,
  agent_id,
  createObjectivesAction,
  onGenerate,
  isGenerating = false,
  objectiveMapping = {},
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
    return [];
  }, [objective_suggestions, effectiveObjectiveMapping]);

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
  const isInitialMountRef = useRef(true);
  const objectiveIdMapRef = useRef<Map<string, string>>(new Map()); // Maps objective text -> objective_id

  // Sync external objective_ids changes (when loading from server)
  useEffect(() => {
    if (ids.length > 0 && Object.keys(effectiveObjectiveMapping).length > 0) {
      const texts = ids
        .map((id) => effectiveObjectiveMapping[id] || "")
        .filter((text) => text.trim() !== "");
      if (texts.length > 0) {
        setInternalTexts(texts.length > 0 ? texts : [""]);
        // Update mapping
        ids.forEach((id, idx) => {
          if (texts[idx]) {
            objectiveIdMapRef.current.set(texts[idx], id);
          }
        });
      }
    }
  }, [ids, effectiveObjectiveMapping]);

  // Debounced resource creation for each objective text
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
    const newObjectiveIds: string[] = [];
    // Use promises to track async operations
    const promises: Promise<void>[] = [];

    internalTexts.forEach((text, index) => {
      if (!text.trim()) {
        // Skip empty texts
        return;
      }

      // Check if we already have an ID for this text
      const existingId = objectiveIdMapRef.current.get(text);
      if (existingId) {
        newObjectiveIds.push(existingId);
        return;
      }

      // Debounce creation for this text
      const promise = (async () => {
        const effectiveAgentId = objectives_agent_id ?? agent_id;
        if (createObjectivesAction && effectiveAgentId && group_id) {
          try {
            const result = await createObjectivesAction({
              body: {
                agent_id: effectiveAgentId,
                group_id: group_id,
                objective: text,
                mcp: false,
              },
            });
            if (result.objective_id) {
              objectiveIdMapRef.current.set(text, result.objective_id);
              // Update parent with all IDs
              const allIds = internalTexts
                .map((t) => {
                  if (!t.trim()) return null;
                  return objectiveIdMapRef.current.get(t) || null;
                })
                .filter((id): id is string => id !== null);
              onChange(allIds);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create objective resource for "${text}":`,
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

    // Capture ref value at effect start for cleanup
    const timersAtStart = debounceTimersRef.current;

    return () => {
      // Use captured ref value for cleanup
      timersAtStart.forEach((timer) => clearTimeout(timer));
      timersAtStart.clear();
    };
  }, [
    internalTexts,
    createObjectivesAction,
    onChange,
    objectives_agent_id,
    agent_id,
    group_id,
  ]);

  const handleItemsChange = useCallback((items: string[]) => {
    setInternalTexts(items.length > 0 ? items : [""]);
  }, []);

  // Check if any objective resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return _objective_resources?.some((o) => o.generated) ?? false;
  }, [_objective_resources]);

  // Don't render if show_objectives is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {(required || objectives_required) && (
              <span className="text-destructive">*</span>
            )}
          </Label>
          {onGenerate && (objectives_agent_id || agent_id) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
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
