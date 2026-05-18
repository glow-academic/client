/**
 * Colors.tsx
 * Resource component for color picker fields
 * Full UI component with Label + Color picker (SelectableGrid + hex input)
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ColorResourceItem {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  hex_code?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ColorItem {
  hex: string;
  name: string;
  id?: string | null; // Include id for unique keys when available
  index?: number; // Include index as fallback for uniqueness
}

export interface ColorsProps {
  color_id?: string | null; // Current color_id (standardized prop name)
  color_resource?: ColorResourceItem | null; // Resource data from server (standardized prop name; includes generated field)
  show_color?: boolean; // Whether to show this resource picker
  colors?: ColorResourceItem[]; // All available colors from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onColorIdChange?: (colorId: string | null) => void; // Update color_id in parent form state (single-select)
  color_ids?: string[]; // Current color resource IDs (multi-select)
  color_resources?: ColorResourceItem[]; // Selected color resources (multi-select)
  onChange?: (ids: string[]) => void; // Update color_ids in parent form state (multi-select)
  multiSelect?: boolean; // Whether to use multi-select mode
  label?: string;
  id?: string;
  required?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  showSelectedFilter?: boolean;
  onShowSelectedChange?: (value: boolean) => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Per-field pending lifecycle. See Names.tsx for the full pattern. */
  onAcceptPending?: (pendingId: string) => void;
  onRejectPending?: (pendingId: string) => void;
  // Legacy props for backward compatibility
  colorResource?: {
    id: string;
    name: string;
    description: string;
    hex_code: string;
    generated?: boolean | null;
  } | null;
  colorId?: string | null;
  presetColors?: ColorItem[];
}

export function Colors({
  color_id,
  color_resource,
  show_color = false,
  colors,
  disabled = false,
  onColorIdChange,
  color_ids,
  color_resources,
  onChange,
  multiSelect = false,
  label = "Color",
  id = "color",
  required = false,
  searchTerm = "",
  onSearchChange: _onSearchChange,
  searchPlaceholder: _searchPlaceholder = "Search colors...",
  showSelectedFilter = false,
  onShowSelectedChange: _onShowSelectedChange,
  isAutosaveEnabled = true,
  onAcceptPending,
  onRejectPending,
  // Legacy props for backward compatibility
  colorResource,
  colorId: _colorId,
  presetColors,
}: ColorsProps) {
  // Use standardized props with fallback to legacy props
  const resource = color_resource ?? colorResource ?? null;
  const _resourceId = color_id ?? _colorId ?? null;
  const show = show_color ?? false;
  const ids = useMemo(() => color_ids ?? [], [color_ids]);

  // Pending state: current resource has pending=true (soft draft, awaiting acceptance)
  const isPending = resource?.pending === true;
  const showDiff = isPending;

  // Accept pending — confirm the pending resource as the active selection.
  // Use the parent's accept hook when supplied so it can sync
  // ``pending_ids`` alongside the id swap. See Names.tsx for the pattern.
  const handleAccept = useCallback(() => {
    if (!resource?.id) return;
    if (resource.hex_code) {
      setInternalValue(resource.hex_code);
      lastSavedValueRef.current = resource.hex_code;
      isDirtyRef.current = false;
    }
    if (onAcceptPending) {
      onAcceptPending(resource.id);
    } else if (onColorIdChange) {
      onColorIdChange(resource.id);
    }
  }, [resource, onAcceptPending, onColorIdChange]);

  // Reject pending — drop the pending resource from form state.
  const handleReject = useCallback(() => {
    const pendingId = resource?.id;
    if (onRejectPending && pendingId) {
      onRejectPending(pendingId);
    } else if (onColorIdChange) {
      onColorIdChange(null);
    }
  }, [resource, onRejectPending, onColorIdChange]);
  
  // Track which color IDs have already had resources created (multi-select)
  const createdColorIdsRef = useRef<Set<string>>(new Set());
  
  // Initialize createdColorIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdColorIdsRef.current.add(id));
  }, [ids]);
  
  // Convert colors array from API format to ColorItem format
  const presetColorsList = useMemo(() => {
    if (colors && colors.length > 0) {
      return colors
        .filter((c) => c.hex_code && c.name) // Filter out nulls
        .map((c, index) => ({
          hex: c.hex_code!,
          name: c.name!,
          id: c.id ?? null, // Preserve id for unique keys
          index, // Include index as fallback for uniqueness
        }));
    }
    // For presetColors (legacy), add index for uniqueness
    return (presetColors ?? []).map((c, index) => ({
      ...c,
      index,
    }));
  }, [colors, presetColors]);

  // Handle nullable resource properties
  const resourceHexCode = resource?.hex_code ?? null;
  const [internalValue, setInternalValue] = useState(resourceHexCode || "");
  const lastSavedValueRef = useRef<string>(resourceHexCode || "");
  const isInitialMountRef = useRef(true);
  // Dirty flag: once the user interacts, stop syncing from server so we don't
  // clobber their in-progress selection (same pattern as Descriptions.tsx).
  const isDirtyRef = useRef(false);

  // Update internal value when color_resource changes — skip while user is editing.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (resourceHexCode) {
      setInternalValue(resourceHexCode);
      lastSavedValueRef.current = resourceHexCode;
    }
  }, [resourceHexCode]);

  // Normalize current color for comparison
  const currentColor = useMemo(() => {
    if (!internalValue) return "";
    return internalValue.toLowerCase().startsWith("#")
      ? internalValue.toLowerCase()
      : `#${internalValue.toLowerCase()}`;
  }, [internalValue]);

  // Track and report pending changes (for manual save mode only)
  useEffect(() => {
    // Only report pending changes when autosave is disabled
    // When autosave is enabled, Persona.tsx handles the "saving" state directly
    if (isAutosaveEnabled) {
      return;
    }

    // Skip on initial mount
    if (isInitialMountRef.current) {
      return;
    }

    const hasPendingChanges = internalValue !== lastSavedValueRef.current;
    if (hasPendingChanges) {
      // Notify save context that there are unsaved changes
      window.dispatchEvent(
        new CustomEvent("unsaved-changes", { detail: { hasChanges: true } })
      );
    }
  }, [internalValue, isAutosaveEnabled]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
    isDirtyRef.current = newValue !== lastSavedValueRef.current;

    // Look up the color's existing ID from the colors array and update formState immediately
    // Pre-defined colors have IDs, so we just need to find the matching one
    if (newValue && colors) {
      const normalizedValue = newValue.toLowerCase().startsWith("#")
        ? newValue.toLowerCase()
        : `#${newValue.toLowerCase()}`;
      const selectedColor = colors.find((c) => c.hex_code?.toLowerCase() === normalizedValue);
      if (selectedColor?.id && onColorIdChange) {
        onColorIdChange(selectedColor.id);
        lastSavedValueRef.current = newValue;
        isDirtyRef.current = false;
        return;
      }
    }

    // If no value, clear the selection
    if (!newValue && onColorIdChange) {
      onColorIdChange(null);
      lastSavedValueRef.current = "";
      isDirtyRef.current = false;
    }
  }, [colors, onColorIdChange]);

  // Build a set of suggested hex codes from colors with suggested=true
  const suggestedHexCodes = useMemo(() => {
    if (!colors) return new Set<string>();
    const suggestedSet = new Set<string>();
    colors.forEach((color) => {
      if (color.suggested && color.hex_code) {
        suggestedSet.add(color.hex_code.toLowerCase());
      }
    });
    return suggestedSet;
  }, [colors]);

  // Filter colors by search term
  const filteredColors = useMemo(() => {
    if (!searchTerm.trim()) {
      return presetColorsList;
    }
    const searchLower = searchTerm.toLowerCase();
    return presetColorsList.filter(
      (color) =>
        color.name.toLowerCase().includes(searchLower) ||
        color.hex.toLowerCase().includes(searchLower)
    );
  }, [presetColorsList, searchTerm]);

  // Filter by showSelected if enabled
  const displayColors = useMemo(() => {
    let result = filteredColors;
    if (showSelectedFilter) {
      result = result.filter(
        (color) => color.hex.toLowerCase() === currentColor
      );
    }
    return result;
  }, [filteredColors, showSelectedFilter, currentColor]);

  // Convert colors array to items format for GenericPicker (multi-select)
  const colorItems = useMemo(() => {
    return (colors ?? [])
      .filter((c) => c.id && c.name) // Filter out nulls
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        ...(c.description ? { description: c.description } : {}),
        ...(c.hex_code ? { hex_code: c.hex_code } : {}),
      }));
  }, [colors]);

  // Filter colors by search term (multi-select)
  const filteredColorItems = useMemo(() => {
    if (!searchTerm) return colorItems;
    const term = searchTerm.toLowerCase();
    return colorItems.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term) ||
        c.hex_code?.toLowerCase().includes(term)
    );
  }, [colorItems, searchTerm]);

  // Filter by showSelectedFilter if enabled (multi-select)
  const displayColorItems = useMemo(() => {
    if (showSelectedFilter) {
      return filteredColorItems.filter((c) => ids.includes(c.id));
    }
    return filteredColorItems;
  }, [filteredColorItems, showSelectedFilter, ids]);

  // Check if a color is suggested (multi-select)
  const isSuggested = useCallback(
    (colorId: string) => {
      const color = colors?.find((c) => c.id === colorId);
      return color?.suggested === true;
    },
    [colors]
  );

  const handleSelectMulti = useCallback(
    async (selectedIds: string[]) => {
      // Update parent state
      if (onChange) {
        onChange(selectedIds);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, onChange]
  );

  // Don't render if show_color is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Multi-select mode — canonical swatch-card grid (matches single-select rendering).
  if (multiSelect) {
    const pendingColorIds = new Set(
      (colors ?? [])
        .filter((c) => c.pending && c.id)
        .map((c) => c.id as string)
    );
    return (
      <div className="space-y-2">
        {label && (
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {required && <span className="text-destructive">*</span>}
            </Label>
          </div>
        )}
        <SelectableGrid<{ id: string; name: string; description?: string; hex_code?: string }>
          items={displayColorItems}
          selectedId={null}
          selectedIds={ids}
          onSelect={(nextId) => {
            const toggled = ids.includes(nextId)
              ? ids.filter((x) => x !== nextId)
              : [...ids, nextId];
            void handleSelectMulti(toggled);
          }}
          getId={(item) => item.id}
          renderItem={(item, isSelected) => {
            const isPendingColor = pendingColorIds.has(item.id);
            return (
              <div
                className={cn(
                  "relative flex items-center gap-2 p-2 rounded-lg border bg-card text-card-foreground shadow-sm transition-all text-left h-10 pr-8",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected && !isPendingColor && "ring-2 ring-primary bg-accent",
                  isPendingColor && "ring-2 ring-success bg-success/10"
                )}
              >
                {isSelected && !isPendingColor && (
                  <div className="absolute top-1/2 right-1.5 -translate-y-1/2 z-10 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
                {isPendingColor && (
                  <div className="absolute top-1/2 right-1.5 -translate-y-1/2 z-10 px-1 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </div>
                )}
                {!isSelected && !isPendingColor && isSuggested(item.id) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {item.hex_code && (
                  <div
                    className="w-5 h-5 rounded border border-border shrink-0"
                    style={{ backgroundColor: item.hex_code }}
                  />
                )}
                <h3 className="font-medium text-sm leading-tight truncate flex-1 min-w-0">
                  {item.name}
                </h3>
                {item.hex_code && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 uppercase">
                    {item.hex_code}
                  </span>
                )}
              </div>
            );
          }}
          emptyMessage="No colors found."
          disabled={disabled}
          horizontal
        />
      </div>
    );
  }

  // Single-select mode (existing logic)
  return (
    <div className="space-y-2 min-w-0 w-full">
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
        {/* Hex input: flex-right on the label row so it stays aligned with the title. */}
        <div className="ml-auto flex items-center gap-2">
          <Input
            id={`${id}Input`}
            value={internalValue || ""}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === "" || /^#?[0-9A-Fa-f]*$/.test(inputValue)) {
                handleChange(
                  inputValue.startsWith("#") ? inputValue : `#${inputValue}`,
                );
              }
            }}
            placeholder="#000000"
            className="h-8 w-28 text-xs font-mono"
            disabled={disabled}
          />
          <div
            className="w-6 h-6 rounded border shrink-0"
            style={{ backgroundColor: internalValue || "transparent" }}
          />
        </div>
      </div>

      {/* Color Grid */}
      {displayColors.length > 0 && (
        <SelectableGrid<ColorItem>
          items={displayColors}
          selectedId={null} // Don't use selectedId since we're using unique IDs, not hex codes
          onSelect={(selectedId) => {
            // selectedId is the unique key, find the color item to get its hex
            const selectedColor = displayColors.find((color) => {
              const colorId = color.id
                ? color.id
                : `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
              return colorId === selectedId;
            });
            if (selectedColor) {
              const normalizedCurrent = currentColor;
              const selectedHex = selectedColor.hex.toLowerCase();
              handleChange(
                selectedHex === normalizedCurrent ? "" : selectedHex
              );
            }
          }}
          getId={(color) => {
            // Use id if available, otherwise use hex + name + index for uniqueness
            // This ensures unique React keys even when hex codes are duplicated
            if (color.id) {
              return color.id;
            }
            return `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
          }}
          // Use selectedIds to mark all colors with matching hex as selected
          selectedIds={
            currentColor
              ? displayColors
                  .filter(
                    (color) =>
                      color.hex.toLowerCase() === currentColor.toLowerCase()
                  )
                  .map((color) => {
                    // Map to the unique ID for each matching color
                    return color.id
                      ? color.id
                      : `${color.hex.toLowerCase()}-${color.name}-${color.index ?? 0}`;
                  })
              : undefined
          }
          renderItem={(color, isSelected) => {
            const isPendingColor = showDiff && resource?.hex_code?.toLowerCase() === color.hex.toLowerCase();

            return (
            <div
              className={cn(
                "relative flex items-center gap-2 p-2 rounded-lg border bg-card text-card-foreground shadow-sm transition-all text-left h-10 pr-8",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPendingColor && "ring-2 ring-primary bg-accent",
                isPendingColor && "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && !isPendingColor && (
                <div className="absolute top-1/2 right-1.5 -translate-y-1/2 z-10 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              {isPendingColor && (
                <div className="absolute top-1/2 right-1.5 -translate-y-1/2 z-10 px-1 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}
              {!isSelected &&
                !isPendingColor &&
                suggestedHexCodes.has(color.hex.toLowerCase()) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              <div
                className="w-5 h-5 rounded border border-border shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <h3 className="font-medium text-sm leading-tight truncate flex-1 min-w-0">
                {color.name}
              </h3>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 uppercase">
                {color.hex}
              </span>
            </div>
          );
          }}
          emptyMessage="No colors found. Try adjusting your search."
          disabled={disabled}
          horizontal
        />
      )}

    </div>
  );
}
