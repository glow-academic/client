/**
 * Points.tsx
 * Resource component for points selection (numeric values)
 * Uses SelectableGrid for single-select from available points options
 * Supports custom numeric input to create point resources
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;

// Derive resource item type from the GET endpoint response
type PointsGetResponse = OutputOf<"/api/v4/resources/points/get", "post">;
export type PointsResourceItem = NonNullable<PointsGetResponse["items"]>[number];

export interface PointsProps {
  points_id?: string | null; // Current points_id (standardized prop name)
  points_resource?: PointsResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_points?: boolean; // Whether to show this resource picker
  points_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  points?: PointsResourceItem[]; // Array of points option objects (for picker)
  disabled?: boolean; // Based on can_edit flag
  onPointsIdChange: (pointsId: string | null) => void; // Update points_id in parent form state
  onGenerate?: () => Promise<void>;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  label?: string;
  id?: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  createPointsAction?:
    | ((input: CreateDraftPointsIn) => Promise<CreateDraftPointsOut>)
    | undefined;
  // Legacy props for backward compatibility
  pointsResource?: PointsResourceItem | null;
  pointsId?: string | null;
  suggestions?: string[];
  aiPointsResources?: Pick<PointsResourceItem, "id" | "value">[] | null;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ points_id: string | null } | void>) => void;
}

export function Points({
  points_id,
  points_resource,
  show_points = true,
  points_suggestions,
  points,
  disabled = false,
  onPointsIdChange,
  onGenerate,
  showAiGenerate = false,
  label = "Points",
  id = "points",
  required = false,
  helpText,
  placeholder = "Select points...",
  searchTerm = "",
  showSelectedFilter = false,
  group_id,
  create_tool_id,
  createPointsAction,
  // Legacy props for backward compatibility
  pointsResource,
  pointsId: _pointsId,
  suggestions,
  aiPointsResources: _aiPointsResources,
  isAutosaveEnabled = true,
  registerFlush,
}: PointsProps) {
  // AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestion, clear: clearAi } = useResourceAi({
    resourceType: "points",
    groupId: group_id,
  });

  // Use standardized props with fallback to legacy props
  const resource = points_resource ?? pointsResource ?? null;
  const resourceId = points_id ?? _pointsId ?? null;
  const show = show_points ?? true;
  const suggestionsList = useMemo(
    () => points_suggestions ?? suggestions ?? [],
    [points_suggestions, suggestions]
  );
  const pointsArray = useMemo(() => points ?? [], [points]);

  const pointsById = useMemo(() => {
    const mapping = new Map<
      string,
      { id: string | null; value: number | null }
    >();
    pointsArray.forEach((point) => {
      if (point.id) {
        mapping.set(point.id, point);
      }
    });
    return mapping;
  }, [pointsArray]);

  const pointsByValue = useMemo(() => {
    const mapping = new Map<number, string>();
    pointsArray.forEach((point) => {
      if (point.value !== null && point.value !== undefined && point.id) {
        mapping.set(point.value, point.id);
      }
    });
    return mapping;
  }, [pointsArray]);

  const resolvedValue = useMemo(() => {
    if (resource?.value !== null && resource?.value !== undefined) {
      return String(resource.value);
    }
    if (resourceId) {
      const point = pointsById.get(resourceId);
      if (point?.value !== null && point?.value !== undefined) {
        return String(point.value);
      }
    }
    return "";
  }, [resource?.value, resourceId, pointsById]);

  const [internalValue, setInternalValue] = useState(resolvedValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resolvedValue);
  const isInitialMountRef = useRef(true);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ points_id: string | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ points_id: string | null } | void> => {
    // Skip if no action available
    if (!createPointsAction || !create_tool_id || !group_id) {
      return { points_id: resourceId };
    }

    // Skip if no change AND we already have a resource for this value
    if (internalValue === lastSavedValueRef.current && resourceId) {
      return { points_id: resourceId };
    }

    const trimmed = internalValue.trim();
    if (!trimmed) {
      onPointsIdChange(null);
      lastSavedValueRef.current = "";
      return { points_id: null };
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return { points_id: resourceId };
    }

    // Check if there's an existing point with this value
    const existingId = pointsByValue.get(numericValue);
    if (existingId) {
      onPointsIdChange(existingId);
      lastSavedValueRef.current = trimmed;
      return { points_id: existingId };
    }

    try {
      const result = await createPointsAction({
        body: {
          group_id: group_id,
          value: numericValue,
          mcp: false,
          tool_id: create_tool_id ?? undefined,
        },
      });
      if (result.points_id) {
        onPointsIdChange(result.points_id);
        lastSavedValueRef.current = trimmed;
        return { points_id: result.points_id };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create points resource:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  useEffect(() => {
    if (resolvedValue !== internalValue) {
      setInternalValue(resolvedValue);
      lastSavedValueRef.current = resolvedValue;
    }
  }, [resolvedValue, internalValue]);

  // Check if an item is suggested
  const isSuggested = useCallback(
    (itemId: string | null) => {
      if (!itemId) return false;
      return suggestionsList.includes(itemId);
    },
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedId: string) => {
      if (selectedId === resourceId) {
        onPointsIdChange(null);
        setInternalValue("");
        lastSavedValueRef.current = "";
        return;
      }
      const selectedPoint = pointsById.get(selectedId);
      if (selectedPoint?.value !== null && selectedPoint?.value !== undefined) {
        const nextValue = String(selectedPoint.value);
        setInternalValue(nextValue);
        lastSavedValueRef.current = nextValue;
      }
      onPointsIdChange(selectedId);
    },
    [resourceId, pointsById, onPointsIdChange]
  );

  const handleInputChange = useCallback((value: string) => {
    setInternalValue(value);
  }, []);

  useEffect(() => {
    // Skip if autosave is disabled (manual save mode)
    if (!isAutosaveEnabled) {
      return;
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = internalValue.trim();
    if (!trimmed) {
      onPointsIdChange(null);
      lastSavedValueRef.current = "";
      return;
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const existingId = pointsByValue.get(numericValue);
    if (existingId) {
      onPointsIdChange(existingId);
      lastSavedValueRef.current = trimmed;
      return;
    }

    if (!createPointsAction || !create_tool_id || !group_id) {
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await createPointsAction({
          body: {
            group_id: group_id,
            value: numericValue,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });
        if (result.points_id) {
          onPointsIdChange(result.points_id);
          lastSavedValueRef.current = trimmed;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create points resource:", error);
      }
    }, 800);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    internalValue,
    isAutosaveEnabled,
    createPointsAction,
    create_tool_id,
    group_id,
    onPointsIdChange,
    pointsByValue,
  ]);

  const filteredPoints = useMemo(() => {
    const items = pointsArray.filter((point) => point.id !== null);
    if (!searchTerm.trim()) {
      return items;
    }
    const term = searchTerm.toLowerCase();
    return items.filter((point) => {
      const value = point.value !== null ? String(point.value) : "";
      const id = point.id ?? "";
      return value.toLowerCase().includes(term) || id.toLowerCase().includes(term);
    });
  }, [pointsArray, searchTerm]);

  const displayPoints = useMemo(() => {
    if (!showSelectedFilter || !resourceId) {
      return filteredPoints;
    }
    return filteredPoints.filter((point) => point.id === resourceId);
  }, [filteredPoints, showSelectedFilter, resourceId]);

  // AI suggestion state from hook
  const aiPointsResources = aiSuggestion ? [aiSuggestion] : [];
  const showDiff = aiPointsResources.length > 0;

  // Accept AI suggestion - select the first AI-suggested points
  const handleAccept = useCallback(() => {
    if (!aiSuggestion) return;
    if (aiSuggestion.id) {
      onPointsIdChange(aiSuggestion.id);
      if (aiSuggestion.value !== null && aiSuggestion.value !== undefined) {
        setInternalValue(String(aiSuggestion.value));
        lastSavedValueRef.current = String(aiSuggestion.value);
      }
    }
    clearAi();
  }, [aiSuggestion, onPointsIdChange, clearAi]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show_points is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {onGenerate && showAiGenerate && create_tool_id && (
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
      {/* AI-suggested points preview */}
      {showDiff && aiPointsResources && aiPointsResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Points</p>
          <div className="space-y-2">
            {aiPointsResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.value !== null && item.value !== undefined
                  ? item.value
                  : "Unknown"}
              </div>
            ))}
          </div>
        </div>
      )}
      <SelectableGrid<{
        id: string | null;
        value: number | null;
        generated?: boolean | null;
      }>
        horizontal
        items={displayPoints}
        selectedId={resourceId ?? null}
        onSelect={handleSelect}
        getId={(item) => item.id || ""}
        renderItem={(item, isSelected) => (
          <div className="relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all">
            {isSelected && (
              <div className="absolute right-2 top-2 text-xs text-primary">
                ✓
              </div>
            )}
            {!isSelected && isSuggested(item.id) && (
              <div className="absolute right-2 top-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                Suggested
              </div>
            )}
            <div className="text-lg font-semibold">
              {item.value !== null && item.value !== undefined
                ? item.value
                : "Unknown"}
            </div>
            <div className="text-xs text-muted-foreground">
              {item.id ? `ID ${item.id.slice(0, 8)}...` : "Custom points"}
            </div>
          </div>
        )}
        emptyMessage="No points found. Try adjusting your search."
        disabled={disabled}
      />
      <div className="space-y-2">
        <Label htmlFor={`${id}-custom`}>Custom Points</Label>
        <Input
          id={`${id}-custom`}
          type="number"
          inputMode="numeric"
          value={internalValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {helpText && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
      </div>
    </div>
  );
}
