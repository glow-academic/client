/**
 * Descriptions.tsx
 * Resource component for description textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import type { CreateDraftDescriptionsIn, CreateDraftDescriptionsOut } from "@/app/(main)/create/personas/p/[personaId]/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DescriptionsProps {
  description_id?: string | null; // Current description_id (standardized prop name)
  description_resource?: { id: string | null; description: string | null } | null; // Resource data from server (standardized prop name)
  show_description?: boolean; // Whether to show this resource picker
  description_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  disabled?: boolean; // Based on can_edit flag
  onDescriptionIdChange: (descriptionId: string | null) => void; // Update description_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  createDescriptionsAction?: ((input: CreateDraftDescriptionsIn) => Promise<CreateDraftDescriptionsOut>) | undefined;
  // Legacy props for backward compatibility
  descriptionResource?: { id: string; description: string } | null;
  descriptionId?: string | null;
  suggestions?: string[];
}

export function Descriptions({
  description_id,
  description_resource,
  show_description = true,
  description_suggestions,
  disabled = false,
  onDescriptionIdChange,
  onGenerate,
  isGenerating = false,
  label = "Description",
  placeholder = "Enter description",
  required = false,
  rows = 4,
  id = "description",
  "data-testid": dataTestId,
  helpText,
  createDescriptionsAction,
  // Legacy props for backward compatibility
  descriptionResource,
  descriptionId,
  suggestions,
}: DescriptionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = description_resource ?? descriptionResource ?? null;
  const resourceId = description_id ?? descriptionId ?? null;
  const show = show_description ?? true;
  const suggestionsList = description_suggestions ?? suggestions ?? [];

  // Don't render if show_description is false
  if (!show) {
    return null;
  }

  // Handle nullable resource properties
  const resourceDescription = resource?.description ?? null;
  const [internalValue, setInternalValue] = useState(
    resourceDescription || ""
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(
    resourceDescription || ""
  );
  const isInitialMountRef = useRef(true);

  // Update internal value when description_resource changes
  useEffect(() => {
    if (resourceDescription) {
      setInternalValue(resourceDescription);
      lastSavedValueRef.current = resourceDescription;
    }
  }, [resourceDescription]);

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
            onDescriptionIdChange(result.description_id);
          }
        } else {
          // Clear resource ID if value is empty
          onDescriptionIdChange(null);
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
  }, [internalValue, createDescriptionsAction, onDescriptionIdChange]);

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
