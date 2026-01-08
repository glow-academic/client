/**
 * Names.tsx
 * Resource component for name input fields
 * Full UI component with Label + Input + optional AI generate button
 * Handles its own draft saving via resource-specific draft endpoint
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NamesProps {
  value: string;
  onChange: (value: string) => void;
  draftId: string | null;
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "data-testid"?: string;
  createDraftNamesAction?:
    | ((input: {
        body: { draft_id: string; name: string };
      }) => Promise<{ name_id?: string | null; version?: number | null }>)
    | undefined;
}

export function Names({
  value,
  onChange,
  draftId,
  onGenerate,
  isGenerating = false,
  label = "Name",
  placeholder = "Enter name",
  required = false,
  disabled = false,
  id = "name",
  "data-testid": dataTestId,
  createDraftNamesAction,
}: NamesProps) {
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
    if (!draftId || !createDraftNamesAction) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await createDraftNamesAction({
          body: {
            draft_id: draftId,
            name: internalValue,
          },
        });
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        // Silently fail - draft saving is best effort
        void error;
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, draftId, createDraftNamesAction]);

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
