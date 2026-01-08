/**
 * Instructions.tsx
 * Resource component for instructions textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface InstructionsProps {
  instructionsResource?: { id: string; template: string } | null; // Resource data from server (composite type)
  instructionsId: string | null; // Current instructions_id (for form state)
  onInstructionsIdChange: (instructionsId: string | null) => void; // Update instructions_id in parent form state
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
  createInstructionsAction?:
    | ((input: {
        body: { template: string };
      }) => Promise<{ instruction_id?: string | null }>)
    | undefined;
}

export function Instructions({
  instructionsResource,
  instructionsId,
  onInstructionsIdChange,
  onGenerate,
  isGenerating = false,
  label = "Instructions",
  placeholder = "Enter instructions",
  required = false,
  disabled = false,
  rows = 8,
  id = "instructions",
  "data-testid": dataTestId,
  helpText,
  createInstructionsAction,
}: InstructionsProps) {
  const [internalValue, setInternalValue] = useState(
    instructionsResource?.template || ""
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(
    instructionsResource?.template || ""
  );
  const isInitialMountRef = useRef(true);

  // Update internal value when instructionsResource changes
  useEffect(() => {
    if (instructionsResource?.template) {
      setInternalValue(instructionsResource.template);
      lastSavedValueRef.current = instructionsResource.template;
    }
  }, [instructionsResource?.template]);

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
    if (!createInstructionsAction) {
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
          const result = await createInstructionsAction({
            body: {
              template: internalValue,
            },
          });
          if (result.instruction_id) {
            onInstructionsIdChange(result.instruction_id);
          }
        } else {
          // Clear resource ID if value is empty
          onInstructionsIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create instructions resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createInstructionsAction, onInstructionsIdChange]);

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
