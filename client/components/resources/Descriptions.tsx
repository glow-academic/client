/**
 * Descriptions.tsx
 * Resource component for description textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DescriptionsProps {
  value: string; // Initial display value (from server data)
  resourceId: string | null; // Current resource_id (for form state)
  onChange: (value: string) => void; // Update display value (for UI only)
  onResourceIdChange: (resourceId: string | null) => void; // Update resource_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  createDescriptionsAction?:
    | ((input: {
        body: { description: string };
      }) => Promise<{ description_id?: string | null }>)
    | undefined;
}

export function Descriptions({
  value,
  resourceId,
  onChange,
  onResourceIdChange,
  onGenerate,
  isGenerating = false,
  label = "Description",
  placeholder = "Enter description",
  required = false,
  disabled = false,
  rows = 4,
  id = "description",
  "data-testid": dataTestId,
  helpText,
  createDescriptionsAction,
}: DescriptionsProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(value);
  const isInitialMountRef = useRef(true);

  // Sync external value changes
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value, internalValue]);

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
    if (!createDescriptionsAction) {
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
          const result = await createDescriptionsAction({
            body: {
              description: internalValue,
            },
          });
          if (result.description_id) {
            onResourceIdChange(result.description_id);
          }
        } else {
          // Clear resource ID if value is empty
          onResourceIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create description resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createDescriptionsAction, onResourceIdChange]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue); // Update display value immediately for UI
    },
    [onChange]
  );

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
      <Textarea
        id={id}
        data-testid={dataTestId}
        value={internalValue || ""}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
      />
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
