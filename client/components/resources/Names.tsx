/**
 * Names.tsx
 * Resource component for name input fields
 * Header-style input with optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;

export interface NamesProps {
  name_id?: string | null; // Current name_id (standardized prop name)
  name_resource?: {
    id: string | null;
    name: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_name?: boolean; // Whether to show this resource picker
  name_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  disabled?: boolean; // Based on can_edit flag
  onNameIdChange: (nameId: string | null) => void; // Update name_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  defaultName?: string; // Default name value (for header style - reverts to this on blur if empty)
  hideDescription?: boolean; // Hide the "Click to edit" description text (useful when parent provides description)
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createNamesAction?:
    | ((input: CreateDraftNamesIn) => Promise<CreateDraftNamesOut>)
    | undefined;
  // Legacy props for backward compatibility
  nameResource?: {
    id: string;
    name: string;
    generated?: boolean | null;
  } | null;
  nameId?: string | null;
  suggestions?: string[];
}

export function Names({
  name_id,
  name_resource,
  show_name = true,
  name_suggestions,
  disabled = false,
  onNameIdChange,
  onGenerate,
  isGenerating = false,
  placeholder = "Enter name",
  required = false,
  id = "name",
  "data-testid": dataTestId,
  defaultName,
  hideDescription = false,
  group_id,
  agent_id,
  createNamesAction,
  // Legacy props for backward compatibility
  nameResource,
  nameId: _nameId,
  suggestions,
}: NamesProps) {
  // Use standardized props with fallback to legacy props
  const resource = name_resource ?? nameResource ?? null;
  const resourceId = name_id ?? _nameId ?? null;
  const show = show_name ?? true;
  const suggestionsList = name_suggestions ?? suggestions ?? [];

  // Handle nullable resource properties
  const resourceName = resource?.name ?? null;
  const initialValue = resourceName || defaultName || "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>(300); // Default min width

  // Use resourceId for validation/debugging
  useEffect(() => {
    if (resourceId && !resource?.id) {
      // Handle mismatch case - resourceId exists but resource doesn't match
      // This can happen during transitions
    }
  }, [resourceId, resource]);

  // Use suggestionsList for autocomplete (if needed in future)
  // Currently suggestions are handled by parent, but we track them here
  const _hasSuggestions = suggestionsList.length > 0;

  // Measure text width and update input width dynamically
  useEffect(() => {
    if (measureRef.current) {
      // Use scrollWidth for more accurate measurement
      const textWidth = measureRef.current.scrollWidth;
      // Add padding (px-2 = 8px on each side = 16px total)
      const padding = 16;
      const minWidth = 50; // Much smaller minimum to allow text-width matching
      setInputWidth(Math.max(textWidth + padding, minWidth));
    }
  }, [internalValue, placeholder, defaultName]);

  // Update internal value when name_resource changes
  useEffect(() => {
    if (resourceName) {
      setInternalValue(resourceName);
      lastSavedValueRef.current = resourceName;
    } else if (defaultName && !resourceName) {
      // If no resource name but defaultName exists, use defaultName
      setInternalValue(defaultName);
      lastSavedValueRef.current = defaultName;
    }
  }, [resourceName, defaultName]);

  // Debounced resource creation
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Skip if no action
    if (!createNamesAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (internalValue.trim() && agent_id && group_id) {
          const result = await createNamesAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
              name: internalValue,
            },
          });
          if (result.name_id) {
            onNameIdChange(result.name_id);
          }
        } else {
          // Clear resource ID if value is empty
          onNameIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create name resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createNamesAction, onNameIdChange]);

  const handleChange = useCallback((newValue: string) => {
    setInternalValue(newValue);
  }, []);

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // If value equals defaultName, select all text on focus
      if (defaultName && e.target.value === defaultName) {
        e.target.select();
      }
    },
    [defaultName]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // If empty on blur and defaultName exists, revert to defaultName
      if (defaultName && (!e.target.value || e.target.value.trim() === "")) {
        setInternalValue(defaultName);
        lastSavedValueRef.current = defaultName;
      }
    },
    [defaultName]
  );

  // Don't render if show_name is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  // Get the display value for measurement
  // When input has value, measure that; otherwise measure placeholder
  const displayValue =
    internalValue || placeholder || defaultName || "Enter name";

  return (
    <div className="flex-1 items-end">
      <div className="flex items-end gap-1">
        {/* Hidden span to measure text width - positioned off-screen but in normal flow */}
        <span
          ref={measureRef}
          className="absolute text-2xl font-semibold whitespace-pre"
          style={{
            visibility: "hidden",
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
          }}
          aria-hidden="true"
        >
          {displayValue || "\u00A0"}
        </span>
        <input
          type="text"
          id={id}
          data-testid={dataTestId}
          value={internalValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || defaultName || "Enter name"}
          required={required}
          disabled={disabled}
          style={{ width: `${inputWidth}px` }}
          className="text-2xl font-semibold border-none outline-none bg-transparent px-2 py-0.5 hover:bg-muted/50 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
        />
        {onGenerate && agent_id && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onGenerate}
                  disabled={disabled || isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
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
      {!hideDescription && (
        <p className="text-xs text-muted-foreground mt-1 px-2">
          {internalValue === defaultName || !internalValue
            ? "Click to edit"
            : "Click to edit"}
        </p>
      )}
    </div>
  );
}
