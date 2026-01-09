/**
 * Names.tsx
 * Resource component for name input fields
 * Header-style input with optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import type { InputOf, OutputOf } from "@/lib/api/types";

type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NamesProps {
  name_id?: string | null; // Current name_id (standardized prop name)
  name_resource?: { id: string | null; name: string | null; generated?: boolean } | null; // Resource data from server (standardized prop name; includes generated field)
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
  createNamesAction?: ((input: CreateDraftNamesIn) => Promise<CreateDraftNamesOut>) | undefined;
  // Legacy props for backward compatibility
  nameResource?: { id: string; name: string; generated?: boolean } | null;
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

  // Don't render if show_name is false
  if (!show) {
    return null;
  }

  // Handle nullable resource properties
  const resourceName = resource?.name ?? null;
  const initialValue = resourceName || defaultName || "";
  const [internalValue, setInternalValue] = useState(initialValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(initialValue);
  const isInitialMountRef = useRef(true);

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
        if (internalValue.trim()) {
          const result = await createNamesAction({
            body: {
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

  return (
    <div className="flex-1">
      <div className="flex items-center gap-2">
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
          className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20 min-w-[300px]"
        />
        {onGenerate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={disabled || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-2">
        {internalValue === defaultName || !internalValue
          ? "Click to edit"
          : "Click to edit"}
      </p>
    </div>
  );
}
