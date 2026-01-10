/**
 * Instructions.tsx
 * Resource component for instructions textarea fields
 * Full UI component with Label + Textarea + optional AI generate button
 * Creates resources independently and reports resource IDs to parent
 */

"use client";

import type { InputOf, OutputOf } from "@/lib/api/types";

type CreateDraftInstructionsIn = InputOf<"/api/v4/resources/instructions", "post">;
type CreateDraftInstructionsOut = OutputOf<"/api/v4/resources/instructions", "post">;
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Sparkles } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";

export interface InstructionsProps {
  instructions_id?: string | null; // Current instructions_id (standardized prop name)
  instructions_resource?: { id: string | null; template: string | null; generated?: boolean | null } | null; // Resource data from server (standardized prop name; includes generated field)
  show_instructions?: boolean; // Whether to show this resource picker
  instructions_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  instructions?: Array<{
    id: string;
    template: string | null;
    generated?: boolean | null;
  }>; // Array of suggested instruction resources (only suggested options, not all)
  disabled?: boolean; // Based on can_edit flag
  onInstructionsIdChange: (instructionsId: string | null) => void; // Update instructions_id in parent form state
  onGenerate?: () => Promise<void>;
  isGenerating?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  id?: string;
  "data-testid"?: string;
  helpText?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createInstructionsAction?: ((input: CreateDraftInstructionsIn) => Promise<CreateDraftInstructionsOut>) | undefined;
  // Legacy props for backward compatibility
  instructionsResource?: { id: string; template: string; generated?: boolean | null } | null;
  instructionsId?: string | null;
  suggestions?: string[];
}

export function Instructions({
  instructions_id,
  instructions_resource,
  show_instructions = true,
  instructions_suggestions,
  instructions,
  disabled = false,
  onInstructionsIdChange,
  onGenerate,
  isGenerating = false,
  label = "Instructions",
  placeholder = "Enter instructions",
  required = false,
  rows = 8,
  id = "instructions",
  "data-testid": dataTestId,
  helpText,
  group_id,
  agent_id,
  createInstructionsAction,
  // Legacy props for backward compatibility
  instructionsResource,
  instructionsId,
  suggestions,
}: InstructionsProps) {
  // Use standardized props with fallback to legacy props
  const resource = instructions_resource ?? instructionsResource ?? null;
  const resourceId = instructions_id ?? instructionsId ?? null;
  const show = show_instructions ?? true;
  const suggestionsList = instructions_suggestions ?? suggestions ?? [];

  // Handle nullable resource properties
  const resourceTemplate = resource?.template ?? null;
  const [internalValue, setInternalValue] = useState(
    resourceTemplate || ""
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = useRef<string>(
    resourceTemplate || ""
  );
  const isInitialMountRef = useRef(true);

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

  // Update internal value when instructions_resource changes
  useEffect(() => {
    if (resourceTemplate) {
      setInternalValue(resourceTemplate);
      lastSavedValueRef.current = resourceTemplate;
    }
  }, [resourceTemplate]);

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
          if (!agent_id || !group_id) {
            return;
          }
          const result = await createInstructionsAction({
            body: {
              agent_id: agent_id,
              group_id: group_id,
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

  // Use instructions array if available, otherwise create placeholder mapping
  const suggestionsMapping = useMemo(() => {
    if (instructions && instructions.length > 0) {
      const mapping: Record<string, { id: string; template: string }> = {};
      instructions.forEach((inst) => {
        if (inst.id) {
          mapping[inst.id] = {
            id: inst.id,
            template: inst.template || `Instructions ${inst.id.slice(0, 8)}...`,
          };
        }
      });
      return mapping;
    }
    // Fallback: create placeholder mapping from suggestion IDs
    const mapping: Record<string, { id: string; template: string }> = {};
    suggestionsList.forEach((suggestionId) => {
      mapping[suggestionId] = {
        id: suggestionId,
        template: `Instructions ${suggestionId.slice(0, 8)}...`,
      };
    });
    return mapping;
  }, [instructions, suggestionsList]);
  
  // Use instructions array for GenericPicker items if available
  const pickerItems = instructions && instructions.length > 0 
    ? instructions 
    : Object.values(suggestionsMapping);

  // Don't render if show_instructions is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {/* GenericPicker for suggestions */}
      {(suggestionsList.length > 0 || (instructions && instructions.length > 0)) && (
        <div className="flex justify-end">
          <GenericPicker
            items={pickerItems}
            selectedIds={resourceId ? [resourceId] : []}
            onSelect={(ids) => {
              onInstructionsIdChange(ids[0] || null);
            }}
            getId={(item) => (typeof item === 'string' ? item : item.id)}
            getLabel={(item) => {
              if (typeof item === 'string') {
                return `Instructions ${item.slice(0, 8)}...`;
              }
              return item.template || `Instructions ${item.id.slice(0, 8)}...`;
            }}
            placeholder="Instructions"
            disabled={disabled}
            multiSelect={false}
            compact={true}
            buttonClassName="h-8"
            showLabel={false}
          />
        </div>
      )}
      {/* Textarea with generate button inside */}
      <div className="relative">
        <Textarea
          id={id}
          data-testid={dataTestId}
          value={internalValue || ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={onGenerate ? "pr-10" : ""}
        />
        {onGenerate && (
          <div className="absolute top-2 right-2">
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
          </div>
        )}
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
