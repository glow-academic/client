/**
 * Points.tsx
 * Resource component for points selection (numeric values)
 * Uses GenericPicker for single-select from available points options
 * Creates point resources when value is selected and reports resource IDs to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";

type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;

export interface PointsProps {
  points_id?: string | null; // Current points_id (standardized prop name)
  points_resource?: {
    id: string | null;
    value: number | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_points?: boolean; // Whether to show this resource picker
  points_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  points?: Array<{
    id: string | null;
    value: number | null;
    generated?: boolean | null;
  }>; // Array of points option objects (for picker)
  disabled?: boolean; // Based on can_edit flag
  onPointsIdChange: (pointsId: string | null) => void; // Update points_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  id?: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createPointsAction?:
    | ((input: CreateDraftPointsIn) => Promise<CreateDraftPointsOut>)
    | undefined;
  // Legacy props for backward compatibility
  pointsResource?: {
    id: string;
    value: number;
    generated?: boolean | null;
  } | null;
  pointsId?: string | null;
  suggestions?: string[];
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
  isGenerating = false,
  label = "Points",
  id = "points",
  required = false,
  helpText,
  placeholder = "Select points...",
  group_id,
  agent_id,
  createPointsAction,
  // Legacy props for backward compatibility
  pointsResource,
  pointsId: _pointsId,
  suggestions,
}: PointsProps) {
  // Use standardized props with fallback to legacy props
  const resource = points_resource ?? pointsResource ?? null;
  const resourceId = points_id ?? _pointsId ?? null;
  const show = show_points ?? true;
  const suggestionsList = useMemo(
    () => points_suggestions ?? suggestions ?? [],
    [points_suggestions, suggestions]
  );
  const pointsArray = useMemo(() => points ?? [], [points]);

  // Use points array for GenericPicker items
  const pickerItems = useMemo(() => {
    if (pointsArray && pointsArray.length > 0) {
      return pointsArray;
    }
    return [];
  }, [pointsArray]);

  // Check if an item is suggested
  const isSuggested = useCallback(
    (itemId: string | null) => {
      if (!itemId) return false;
      return suggestionsList.includes(itemId);
    },
    [suggestionsList]
  );

  // Handle selection - create/get point resource if needed
  const handleSelect = useCallback(
    async (ids: string[]) => {
      const selectedId = ids[0] || null;

      if (selectedId) {
        // Find the selected point to get its value
        const selectedPoint = pointsArray.find((p) => p.id === selectedId);

        if (selectedPoint && selectedPoint.value !== null) {
          // Check if we need to create a new point resource
          // If the selected point doesn't exist in our points array, create it
          if (!selectedPoint.id && createPointsAction && agent_id && group_id) {
            try {
              const result = await createPointsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  value: selectedPoint.value,
                  mcp: false,
                },
              });
              if (result.points_id) {
                onPointsIdChange(result.points_id);
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error("Failed to create points resource:", error);
            }
          } else {
            // Use existing point ID
            onPointsIdChange(selectedId);
          }
        } else {
          onPointsIdChange(selectedId);
        }
      } else {
        // Clear selection
        onPointsIdChange(null);
      }
    },
    [pointsArray, createPointsAction, agent_id, group_id, onPointsIdChange]
  );

  // Don't render if show_points is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {label && (
          <label htmlFor={id} className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive">*</span>}
          </label>
        )}
        {onGenerate && agent_id && (
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
                {resource?.generated ? "Regenerate" : "Generate"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <GenericPicker<{
        id: string | null;
        value: number | null;
        generated?: boolean | null;
      }>
        items={pickerItems}
        selectedIds={resourceId ? [resourceId] : []}
        onSelect={handleSelect}
        multiSelect={false}
        getId={(item) => item.id || ""}
        getLabel={(item) => {
          if (item.value !== null && item.value !== undefined) {
            return `${item.value}`;
          }
          return item.id ? `Points ${item.id.slice(0, 8)}...` : "Unknown";
        }}
        getSearchText={(item) => {
          const valueStr = item.value !== null ? String(item.value) : "";
          const idStr = item.id || "";
          return `${valueStr} ${idStr}`;
        }}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {item.value !== null && item.value !== undefined
                    ? `${item.value}`
                    : item.id
                      ? `Points ${item.id.slice(0, 8)}...`
                      : "Unknown"}
                </div>
              </div>
            </div>
            {isSelected && (
              <div className="ml-auto flex-shrink-0 text-primary">✓</div>
            )}
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        description={helpText}
        emptyMessage="No points available"
        groupHeading="Points"
        id={id}
      />
    </div>
  );
}
