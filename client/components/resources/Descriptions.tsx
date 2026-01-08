/**
 * Descriptions.tsx
 * Resource component for description textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Handles its own draft saving via resource-specific draft endpoint
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DescriptionsProps {
  value: string;
  onChange: (value: string) => void;
  draftId: string | null;
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
  createDraftDescriptionsAction?:
    | ((input: {
        body: { draft_id: string; description: string };
      }) => Promise<{ description_id?: string | null; version?: number | null }>)
    | undefined;
}

export function Descriptions({
  value,
  onChange,
  draftId,
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
  createDraftDescriptionsAction,
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
  }, [value]);

  // Debounced autosave
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

    // Skip if no draftId or no action
    if (!draftId || !createDraftDescriptionsAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await createDraftDescriptionsAction({
          body: {
            draft_id: draftId,
            description: internalValue,
          },
        });
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to save draft description:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, draftId, createDraftDescriptionsAction]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onChange(newValue);
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
            disabled={disabled || isGenerating || !draftId}
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
