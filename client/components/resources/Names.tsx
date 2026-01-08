/**
 * Names.tsx
 * Resource component for name input fields
 * Full UI component with Label + Input + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import type { CreateDraftNamesIn, CreateDraftNamesOut } from "@/app/(main)/create/personas/p/[personaId]/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NamesProps {
  name_id?: string | null; // Current name_id (standardized prop name)
  name_resource?: { id: string | null; name: string | null } | null; // Resource data from server (standardized prop name)
  show_name?: boolean; // Whether to show this resource picker
  name_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  disabled?: boolean; // Based on can_edit flag
  onNameIdChange: (nameId: string | null) => void; // Update name_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  "data-testid"?: string;
  createNamesAction?: ((input: CreateDraftNamesIn) => Promise<CreateDraftNamesOut>) | undefined;
  // Legacy props for backward compatibility
  nameResource?: { id: string; name: string } | null;
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
  label = "Name",
  placeholder = "Enter name",
  required = false,
  id = "name",
  "data-testid": dataTestId,
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
  const [internalValue, setInternalValue] = useState(resourceName || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(resourceName || "");
  const isInitialMountRef = useRef(true);

  // Update internal value when name_resource changes
  useEffect(() => {
    if (resourceName) {
      setInternalValue(resourceName);
      lastSavedValueRef.current = resourceName;
    }
  }, [resourceName]);

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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
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
      <Input
        id={id}
        data-testid={dataTestId}
        value={internalValue || ""}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}
