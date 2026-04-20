/**
 * Points.tsx
 * Resource component for points selection (numeric values)
 * Uses SelectableGrid for single-select from available points options
 * Supports custom numeric input
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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface PointsResourceItem {
  id?: string | null;
  value?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface PointsProps {
  points_id?: string | null; // Current points_id (standardized prop name)
  points_resource?: PointsResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_points?: boolean; // Whether to show this resource picker
  points?: PointsResourceItem[]; // Array of points option objects (for picker)
  disabled?: boolean; // Based on can_edit flag
  onPointsIdChange: (pointsId: string | null) => void; // Update points_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  // Legacy props for backward compatibility
  pointsResource?: PointsResourceItem | null;
  pointsId?: string | null;
}

export function Points({
  points_id,
  points_resource,
  show_points = true,
  points,
  disabled = false,
  onPointsIdChange,
  label = "Points",
  id = "points",
  required = false,
  helpText,
  placeholder = "Select points...",
  searchTerm = "",
  showSelectedFilter = false,
  // Legacy props for backward compatibility
  pointsResource,
  pointsId: _pointsId,
}: PointsProps) {
  // Use standardized props with fallback to legacy props
  const resource = points_resource ?? pointsResource ?? null;
  const resourceId = points_id ?? _pointsId ?? null;
  const show = show_points ?? true;
  const pointsArray = useMemo(() => points ?? [], [points]);

  const pointsById = useMemo(() => {
    const mapping = new Map<string, PointsResourceItem>();
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
  const debounceTimerRef = useMemo(() => ({ current: null as NodeJS.Timeout | null }), []);

  useEffect(() => {
    if (resolvedValue !== internalValue) {
      setInternalValue(resolvedValue);
    }
  }, [resolvedValue, internalValue]);

  // Check if an item is suggested (from item.suggested field)
  const isSuggested = useCallback(
    (itemId: string | null) => {
      if (!itemId) return false;
      const point = pointsById.get(itemId);
      return point?.suggested === true;
    },
    [pointsById]
  );

  const handleSelect = useCallback(
    (selectedId: string) => {
      if (selectedId === resourceId) {
        onPointsIdChange(null);
        setInternalValue("");
        return;
      }
      const selectedPoint = pointsById.get(selectedId);
      if (selectedPoint?.value !== null && selectedPoint?.value !== undefined) {
        setInternalValue(String(selectedPoint.value));
      }
      onPointsIdChange(selectedId);
    },
    [resourceId, pointsById, onPointsIdChange]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInternalValue(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const trimmed = value.trim();
      if (!trimmed) {
        onPointsIdChange(null);
        return;
      }

      const numericValue = Number(trimmed);
      if (!Number.isFinite(numericValue)) {
        return;
      }

      // Debounce lookup to avoid rapid calls while typing
      debounceTimerRef.current = setTimeout(() => {
        const existingId = pointsByValue.get(numericValue);
        if (existingId) {
          onPointsIdChange(existingId);
        }
      }, 300);
    },
    [onPointsIdChange, pointsByValue, debounceTimerRef]
  );

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

  // Pending state: items with pending=true from soft draft connections
  const pendingIds = useMemo(
    () =>
      new Set(
        pointsArray
          .filter((point) => point.pending && point.id)
          .map((point) => point.id as string)
      ),
    [pointsArray]
  );
  const showDiff = (resource?.pending ?? false) || pendingIds.size > 0;

  // Accept pending — keep pending points in selection (no-op, already selected)
  const handleAccept = useCallback(() => {
    // Pending items are already in selection (selected=true), just confirm
    // The next draft save will persist them as active
  }, []);

  // Reject pending — remove pending points from selection
  const handleReject = useCallback(() => {
    if (resourceId && (pendingIds.has(resourceId) || resource?.pending)) {
      onPointsIdChange(null);
      setInternalValue("");
    }
  }, [onPointsIdChange, pendingIds, resourceId, resource?.pending]);

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
      <SelectableGrid<{
        id: string | null;
        value: number | null;
        generated?: boolean | null;
      }>
        horizontal
        items={
          displayPoints as Array<{
            id: string | null;
            value: number | null;
            generated?: boolean | null;
          }>
        }
        selectedId={resourceId ?? null}
        onSelect={handleSelect}
        getId={(item) => item.id || ""}
        renderItem={(item, isSelected) => {
          const isPending = !!(item.id && pendingIds.has(item.id));
          return (
          <div
            className={cn(
              "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
              isSelected && !isPending && "ring-2 ring-primary bg-accent",
              isPending && "ring-2 ring-success bg-success/10"
            )}
          >
            {isSelected && !isPending && (
              <div className="absolute right-2 top-2 text-xs text-primary">✓</div>
            )}
            {isPending && (
              <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                Pending
              </div>
            )}
            {!isSelected && !isPending && isSuggested(item.id) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute top-2 right-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Suggested</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
        )}}
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
